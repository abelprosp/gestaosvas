"use client";
import {
  Badge,
  Box,
  Button,
  Checkbox,
  CheckboxGroup,
  Heading,
  HStack,
  Input,
  Select,
  Stack,
  Table,
  Tbody,
  Td,
  Text,
  Th,
  Thead,
  Tr,
  useColorModeValue,
  useToast,
  VStack,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchServiceReport } from "@/lib/api/reports";
import { ServiceReportRow, Service } from "@/types";
import { ServiceReportCategory } from "./types";
import { exportToCsv } from "@/lib/utils/exporters";
import { api } from "@/lib/api/client";

const CATEGORY_LABELS: Record<ServiceReportRow["category"], string> = {
  TV: "TV",
  CLOUD: "Cloud",
  SERVICE: "Serviço",
  HUB: "Hub",
  TELE: "Tele",
};

const CATEGORY_COLORS: Record<ServiceReportRow["category"], string> = {
  TV: "purple",
  CLOUD: "blue",
  HUB: "orange",
  TELE: "pink",
  SERVICE: "gray",
};

const QUICK_FILTERS: Array<{
  label: string;
  service: string;
  category: ServiceReportCategory | "ALL";
}> = [
  { label: "Cloud 150GB", service: "Cloud 150GB", category: "CLOUD" },
  { label: "HubPlay Premium", service: "HubPlay Premium", category: "HUB" },
  { label: "Telemedicina e Telepet", service: "Telemedicina e Telepet", category: "TELE" },
  { label: "TV Essencial", service: "TV ESSENCIAL", category: "TV" },
  { label: "TV Premium", service: "TV PREMIUM", category: "TV" },
];

function formatDate(value?: string | null) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("pt-BR");
}

export function ServiceReportsPage() {
  const [documentFilter, setDocumentFilter] = useState("");
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [searchFilter, setSearchFilter] = useState("");
  const [appliedFilters, setAppliedFilters] = useState({
    document: "",
    service: "",
    category: "ALL" as "ALL" | ServiceReportCategory,
    search: "",
  });
  const toast = useToast();
  const cardBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(15, 23, 42, 0.7)");
  const borderColor = useColorModeValue("rgba(226,232,240,0.6)", "rgba(45,55,72,0.6)");

  // Buscar lista de serviços para seleção múltipla
  const { data: servicesData, isLoading: isLoadingServices, error: servicesError } = useQuery<Service[]>({
    queryKey: ["services"],
    queryFn: async () => {
      try {
        const response = await api.get<Service[]>("/services");
        return Array.isArray(response.data) ? response.data : [];
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
        throw error;
      }
    },
    retry: 2,
    staleTime: 5 * 60 * 1000, // Cache por 5 minutos
  });

  const { data, isFetching } = useQuery({
    queryKey: ["serviceReport", appliedFilters],
    queryFn: () =>
      fetchServiceReport({
        document: appliedFilters.document,
        service: appliedFilters.service,
        category: appliedFilters.category,
        search: appliedFilters.search,
      }),
  });

  const rows = useMemo<ServiceReportRow[]>(() => data?.data ?? [], [data]);

  const handleApplyFilters = () => {
    // Converter serviços selecionados em string separada por vírgula para o backend
    const serviceFilterString = selectedServices.length > 0 
      ? selectedServices.map(id => {
          const service = servicesData?.find(s => s.id === id);
          return service?.name ?? "";
        }).filter(Boolean).join(", ")
      : "";
    
    setAppliedFilters({
      document: documentFilter.replace(/\D/g, ""),
      service: serviceFilterString,
      category: "ALL", // Sempre "ALL" já que removemos o filtro de categoria
      search: searchFilter.trim(),
    });
  };

  const handleExport = () => {
    if (!rows.length) {
      toast({ title: "Nenhum dado para exportar", status: "info" });
      return;
    }

    // Criar uma linha por serviço/acesso (sem agrupar)
    const csvData = rows.map((row) => {
      // Buscar valor do serviço: usar custom_price se existir, senão usar valor padrão
      let serviceValue = row.serviceValue;
      if (serviceValue === null || serviceValue === undefined || serviceValue === 0) {
        // Buscar valor padrão do serviço
        // Para TV, buscar pelo nome "TV" genérico
        const serviceNameToSearch = row.serviceName.includes("TV") 
          ? "TV" 
          : row.serviceName;
        const service = servicesData?.find(s => {
          if (s.id === row.serviceId) return true;
          const sName = s.name.toLowerCase();
          const rName = serviceNameToSearch.toLowerCase();
          return sName === rName || sName.includes(rName) || rName.includes(sName);
        });
        serviceValue = service?.price ?? 0;
      }

      return {
        Cliente: row.clientName,
        Servico: row.serviceName,
        "Vendor do Cliente": row.clientVendorName ?? "",
        "Vendor do Serviço": row.serviceVendorName ?? "",
        "Valor do Serviço": serviceValue > 0 ? `R$ ${serviceValue.toFixed(2)}` : "",
        Telefonia: row.hasTelephony === true ? "Sim" : row.hasTelephony === false ? "Não" : "",
        Documento: row.clientDocument,
        Email: row.clientEmail ?? "",
        Categoria: CATEGORY_LABELS[row.category],
        Identificador: row.identifier,
        Responsavel: row.responsible ?? "",
        Plano: row.planType ?? "",
        Status: row.status ?? "",
        Inicio: formatDate(row.startsAt),
        Vencimento: formatDate(row.expiresAt),
        Notas: (row.notes ?? "").replace(/\n/g, " ").replace(/\r/g, ""), // Substituir quebras de linha por espaços
      };
    });

    exportToCsv("relatorio_servicos.csv", csvData);
    toast({ title: "Relatório exportado", status: "success" });
  };

  return (
    <Stack spacing={{ base: 6, md: 8 }}>
      <Box>
        <Heading size="lg">Relatórios de serviços</Heading>
        <Text color="gray.500">
          Filtre por documento, serviço ou categoria para identificar rapidamente quem é o responsável e quais acessos
          foram contratados.
        </Text>
      </Box>

      <Stack direction={{ base: "column", lg: "row" }} spacing={4} align={{ base: "stretch", lg: "flex-start" }}>
        <Input
          placeholder="CPF ou CNPJ do cliente"
          value={documentFilter}
          onChange={(event) => setDocumentFilter(event.target.value)}
          maxW={{ lg: "240px" }}
          h="40px"
        />
        <Box flex="1" minW="220px" maxW={{ lg: "300px" }}>
          <Text fontSize="sm" mb={2} color="gray.600" fontWeight="medium">
            Selecionar serviços:
          </Text>
          {isLoadingServices ? (
            <Box p={3} borderWidth={1} borderRadius="md" borderColor={borderColor} bg={cardBg} h="120px" display="flex" alignItems="center" justifyContent="center">
              <Text fontSize="sm" color="gray.500">Carregando serviços...</Text>
            </Box>
          ) : servicesError ? (
            <Box p={3} borderWidth={1} borderRadius="md" borderColor="red.300" bg={cardBg} h="120px" display="flex" alignItems="center" justifyContent="center">
              <Text fontSize="sm" color="red.500">Erro ao carregar serviços</Text>
            </Box>
          ) : servicesData && servicesData.length > 0 ? (
            <>
              <CheckboxGroup value={selectedServices} onChange={(values) => setSelectedServices(values as string[])}>
                <VStack align="start" spacing={2} maxH="120px" overflowY="auto" p={3} borderWidth={1} borderRadius="md" borderColor={borderColor} bg={cardBg}>
                  {servicesData.map((service) => (
                    <Checkbox key={service.id} value={service.id} size="sm">
                      <Text fontSize="sm">{service.name}</Text>
                    </Checkbox>
                  ))}
                </VStack>
              </CheckboxGroup>
              {selectedServices.length > 0 && (
                <Text fontSize="xs" color="gray.500" mt={2}>
                  {selectedServices.length} serviço(s) selecionado(s)
                </Text>
              )}
            </>
          ) : (
            <Box p={3} borderWidth={1} borderRadius="md" borderColor={borderColor} bg={cardBg} h="120px" display="flex" alignItems="center" justifyContent="center">
              <Text fontSize="sm" color="gray.500">Nenhum serviço disponível</Text>
            </Box>
          )}
        </Box>
        <Input
          placeholder="Buscar por nome ou e-mail"
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          flex="1"
          minW="220px"
          h="40px"
        />
        <HStack spacing={3} align="flex-start" h="40px">
          <Button colorScheme="brand" onClick={handleApplyFilters} isLoading={isFetching} h="40px">
            Aplicar filtros
          </Button>
          <Button variant="outline" onClick={handleExport} isDisabled={!rows.length} h="40px">
            Exportar CSV
          </Button>
        </HStack>
      </Stack>

      <HStack spacing={3} justify="flex-start">
        <Button
          size="sm"
          variant={selectedServices.length === 0 ? "solid" : "ghost"}
          onClick={() => {
            setSelectedServices([]);
            setAppliedFilters({
              document: documentFilter.replace(/\D/g, ""),
              service: "",
              category: "ALL",
              search: searchFilter.trim(),
            });
          }}
        >
          Limpar seleção
        </Button>
      </HStack>

      <Box
        bg={cardBg}
        borderRadius="2xl"
        p={{ base: 4, md: 6 }}
        borderWidth={1}
        borderColor={borderColor}
        boxShadow="lg"
      >
        <Box overflowX="auto">
          <Table
            variant="simple"
            size={{ base: "sm", md: "md" }}
            sx={{
              "th, td": {
                whiteSpace: "nowrap",
              },
            }}
          >
            <Thead>
              <Tr>
                <Th>Cliente</Th>
                <Th>Documento</Th>
                <Th>Categoria</Th>
                <Th>Serviço</Th>
                <Th>Identificador</Th>
                <Th>Responsável</Th>
                <Th>Vencimento</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <Tbody>
              {!rows.length && (
                <Tr>
                  <Td colSpan={8}>
                    <Text color="gray.500">Nenhum dado carregado. Ajuste os filtros e clique em “Aplicar”.</Text>
                  </Td>
                </Tr>
              )}
              {rows.map((row) => (
                <Tr key={`${row.category}-${row.id}`}>
                  <Td>
                    <Text fontWeight="semibold">{row.clientName}</Text>
                    <Text fontSize="sm" color="gray.500">
                      {row.clientEmail ?? "-"}
                    </Text>
                  </Td>
                  <Td>{row.clientDocument}</Td>
                  <Td>
                <Badge colorScheme={CATEGORY_COLORS[row.category]}>{CATEGORY_LABELS[row.category]}</Badge>
                  </Td>
                  <Td>{row.serviceName}</Td>
                  <Td>{row.identifier}</Td>
                  <Td>{row.responsible ?? "-"}</Td>
                  <Td>{formatDate(row.expiresAt)}</Td>
                  <Td>{row.status ?? "-"}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </Box>
        <HStack justify="space-between" mt={4}>
          <Text color="gray.500">Total: {rows.length} registros</Text>
          <Text fontSize="sm" color="gray.400">
            Exibindo no máximo 2.000 linhas. Ajuste filtros para conjuntos maiores.
          </Text>
        </HStack>
      </Box>
    </Stack>
  );
}