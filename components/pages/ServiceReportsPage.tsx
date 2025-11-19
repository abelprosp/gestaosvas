"use client";
import {
  Badge,
  Box,
  Button,
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
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { fetchServiceReport } from "@/lib/api/reports";
import { ServiceReportRow } from "@/types";
import { ServiceReportCategory } from "./types";
import { exportToCsv } from "@/lib/utils/exporters";

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
  const [serviceFilter, setServiceFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | ServiceReportCategory>("ALL");
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
    setAppliedFilters({
      document: documentFilter.replace(/\D/g, ""),
      service: serviceFilter.trim(),
      category: categoryFilter,
      search: searchFilter.trim(),
    });
  };

  const handleExport = () => {
    if (!rows.length) {
      toast({ title: "Nenhum dado para exportar", status: "info" });
      return;
    }
    exportToCsv(
      "relatorio_servicos.csv",
      rows.map((row) => ({
        Cliente: row.clientName,
        Documento: row.clientDocument,
        Email: row.clientEmail ?? "",
        Categoria: CATEGORY_LABELS[row.category],
        Servico: row.serviceName,
        Identificador: row.identifier,
        Responsavel: row.responsible ?? "",
        Plano: row.planType ?? "",
        Status: row.status ?? "",
        Inicio: formatDate(row.startsAt),
        Vencimento: formatDate(row.expiresAt),
        Notas: row.notes ?? "",
      })),
    );
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

      <Stack direction={{ base: "column", lg: "row" }} spacing={4} flexWrap="wrap">
        <Input
          placeholder="CPF ou CNPJ do cliente"
          value={documentFilter}
          onChange={(event) => setDocumentFilter(event.target.value)}
          maxW={{ lg: "240px" }}
        />
        <Input
          placeholder="Nome do serviço (ex.: AFBNDES, TV)"
          value={serviceFilter}
          onChange={(event) => setServiceFilter(event.target.value)}
          flex="1"
          minW="220px"
        />
        <Select
          maxW={{ lg: "220px" }}
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value as typeof categoryFilter)}
        >
          <option value="ALL">Todas as categorias</option>
          <option value="TV">TV</option>
          <option value="CLOUD">Cloud</option>
          <option value="HUB">Hub</option>
          <option value="TELE">Tele</option>
          <option value="SERVICE">Serviços gerais</option>
        </Select>
        <Input
          placeholder="Buscar por nome ou e-mail"
          value={searchFilter}
          onChange={(event) => setSearchFilter(event.target.value)}
          flex="1"
          minW="220px"
        />
        <HStack spacing={3}>
          <Button colorScheme="brand" onClick={handleApplyFilters} isLoading={isFetching}>
            Aplicar filtros
          </Button>
          <Button variant="outline" onClick={handleExport} isDisabled={!rows.length}>
            Exportar CSV
          </Button>
        </HStack>
      </Stack>

      <HStack spacing={3} flexWrap="wrap">
        {QUICK_FILTERS.map((filter) => {
          const isActive =
            serviceFilter.toLowerCase() === filter.service.toLowerCase() &&
            (filter.category === "ALL" || categoryFilter === filter.category);
          return (
            <Button
              key={filter.label}
              size="sm"
              variant={isActive ? "solid" : "outline"}
              colorScheme="brand"
              onClick={() => {
                setServiceFilter(filter.service);
                setCategoryFilter(filter.category === "ALL" ? "ALL" : filter.category);
                setAppliedFilters({
                  document: documentFilter.replace(/\D/g, ""),
                  service: filter.service,
                  category: filter.category,
                  search: searchFilter.trim(),
                });
              }}
            >
              {filter.label}
            </Button>
          );
        })}
        <Button
          size="sm"
          variant={serviceFilter === "" ? "solid" : "ghost"}
          onClick={() => {
            setServiceFilter("");
            setCategoryFilter("ALL");
            setAppliedFilters({
              document: documentFilter.replace(/\D/g, ""),
              service: "",
              category: "ALL",
              search: searchFilter.trim(),
            });
          }}
        >
          Limpar filtro rápido
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