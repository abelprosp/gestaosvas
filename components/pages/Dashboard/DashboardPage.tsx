"use client";
import {
  Box,
  Heading,
  Text,
  SimpleGrid,
  Skeleton,
  VStack,
  HStack,
  Badge,
  useColorModeValue,
  Select,
  Progress,
  FormControl,
  FormLabel,
  Input,
  Checkbox,
  CheckboxGroup,
  Wrap,
  WrapItem,
  Stack,
  Button,
  Collapse,
} from "@chakra-ui/react";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api/client";
import { SalesTimeseries, StatsOverview, ServiceTotals } from "@/types";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Bar,
  LineChart,
  Line,
} from "recharts";

type ChartDatum = {
  label: string;
  value: number;
};

const SALES_COLORS = ["#4c51bf", "#2b6cb0", "#38a169", "#d53f8c", "#dd6b20", "#805ad5", "#319795", "#9f7aea"];

function StatCard({ label, value }: { label: string; value: number }) {
  const cardBg = useColorModeValue("rgba(255, 255, 255, 0.75)", "rgba(15, 23, 42, 0.65)");
  const borderColor = useColorModeValue("gray.100", "gray.700");
  const labelColor = useColorModeValue("gray.500", "gray.400");

  return (
    <Box
      p={6}
      borderRadius="2xl"
      bg={cardBg}
      boxShadow="lg"
      borderWidth={1}
      borderColor={borderColor}
      transition="background-color 0.2s ease"
    >
      <Text fontSize="sm" color={labelColor}>
        {label}
      </Text>
      <Text fontSize="3xl" fontWeight="bold" mt={2} color="brand.600">
        {value}
      </Text>
    </Box>
  );
}

export function DashboardPage() {
  const defaultRange = useMemo(() => {
    const end = new Date();
    const start = new Date(end);
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    const format = (date: Date) => date.toISOString().slice(0, 10);
    return {
      start: format(start),
      end: format(end),
    };
  }, []);

  const placeholder: StatsOverview = {
    metrics: {
      all: { cpf: 0, cnpj: 0, total: 0, lastMonth: 0 },
      essencial: { cpf: 0, cnpj: 0, total: 0, lastMonth: 0 },
      premium: { cpf: 0, cnpj: 0, total: 0, lastMonth: 0 },
    },
    planSummary: [],
    tvUsage: { goal: 5000, used: 0, available: 5000, percentage: 0 },
    recentContracts: [],
    segments: [
      { key: "all", label: "Todos", metrics: { cpf: 0, cnpj: 0, total: 0, lastMonth: 0 } },
      { key: "essencial", label: "TV Essencial", metrics: { cpf: 0, cnpj: 0, total: 0, lastMonth: 0 } },
      { key: "premium", label: "TV Premium", metrics: { cpf: 0, cnpj: 0, total: 0, lastMonth: 0 } },
    ],
    cloudAccesses: 0,
  } as StatsOverview & { cloudAccesses?: number };

  const { data = placeholder, isLoading } = useQuery<StatsOverview>({
    queryKey: ["stats", "overview"],
    queryFn: async () => {
      const response = await api.get<StatsOverview>("/stats/overview");
      return response.data;
    },
    staleTime: 120 * 1000, // 2 minutos - dados considerados "frescos"
    refetchInterval: 60 * 1000, // 1 minuto - reduzido de 10s para melhorar performance
    placeholderData: placeholder,
  });

  const cardBg = useColorModeValue("rgba(255,255,255,0.78)", "rgba(17, 24, 39, 0.7)");
  const cardBorder = useColorModeValue("rgba(226, 232, 240, 0.7)", "rgba(74, 85, 104, 0.5)");
  const mutedText = useColorModeValue("gray.500", "gray.400");
  const listBg = useColorModeValue("rgba(248, 250, 252, 0.7)", "rgba(15, 23, 42, 0.65)");

  const segmentOptions = data.segments.length ? data.segments : placeholder.segments;
  const [selectedSegmentKey, setSelectedSegmentKey] = useState<string>(segmentOptions[0]?.key ?? "all");
  const [startDate, setStartDate] = useState<string>(defaultRange.start);
  const [endDate, setEndDate] = useState<string>(defaultRange.end);
  const [selectedServiceKeys, setSelectedServiceKeys] = useState<string[]>([]);
  const [isTvBreakdownOpen, setIsTvBreakdownOpen] = useState(false);
  
  // Meta manual de arrecadação (salva no localStorage)
  const [revenueGoal, setRevenueGoal] = useState<number>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("dashboard_revenue_goal");
      return saved ? parseFloat(saved) || 0 : 0;
    }
    return 0;
  });
  
  const [isEditingGoal, setIsEditingGoal] = useState(false);
  
  const handleGoalChange = (value: string) => {
    const numValue = parseFloat(value) || 0;
    setRevenueGoal(numValue);
    if (typeof window !== "undefined") {
      localStorage.setItem("dashboard_revenue_goal", numValue.toString());
    }
  };

  // Preferimos filtrar por KEY (mais robusto que nome). O backend aceita keys e nomes.
  const salesFilterKeys = useMemo(() => {
    if (!selectedServiceKeys.length) return [];
    const out: string[] = [];
    for (const key of selectedServiceKeys) {
      if (key === "tv-total") {
        out.push("tv-essencial", "tv-premium");
      } else {
        out.push(key);
      }
    }
    return Array.from(new Set(out)).sort((a, b) => a.localeCompare(b));
  }, [selectedServiceKeys]);

  useEffect(() => {
    if (!segmentOptions.some((segment) => segment.key === selectedSegmentKey)) {
      setSelectedSegmentKey(segmentOptions[0]?.key ?? "all");
    }
  }, [segmentOptions, selectedSegmentKey]);

  const selectedMetrics =
    segmentOptions.find((segment) => segment.key === selectedSegmentKey)?.metrics ?? data.metrics.all;
  const chartData: ChartDatum[] = useMemo(
    () => [
      { label: "CPFs", value: selectedMetrics.cpf },
      { label: "CNPJs", value: selectedMetrics.cnpj },
      { label: "Total", value: selectedMetrics.total },
      { label: "Último mês", value: selectedMetrics.lastMonth },
    ],
    [selectedMetrics],
  );

  // Formatar valor monetário
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
  };

  const salesPlaceholder: SalesTimeseries = {
    range: { start: defaultRange.start, end: defaultRange.end },
    services: [],
    selectedServices: [],
    points: [],
    totalSales: 0,
  };

  const servicesQueryKey = useMemo(
    () => [
      "stats",
      "sales",
      {
        startDate,
        endDate,
        services: salesFilterKeys,
      },
    ],
    [startDate, endDate, salesFilterKeys],
  );

  const salesQuery = useQuery<SalesTimeseries>({
    queryKey: servicesQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) {
        params.set("startDate", startDate);
      }
      if (endDate) {
        params.set("endDate", endDate);
      }
      if (salesFilterKeys.length > 0) {
        params.set("services", salesFilterKeys.join(","));
      }
      const response = await api.get<SalesTimeseries>(`/stats/sales?${params.toString()}`);
      return response.data;
    },
  });

  const salesData = salesQuery.data ?? salesPlaceholder;
  const loadingSales = salesQuery.isLoading;
  const fetchingSales = salesQuery.isFetching;

  // Buscar todos os serviços cadastrados para mostrar no resumo
  const { data: allServices = [], isLoading: isLoadingAllServices } = useQuery({
    queryKey: ["services", "dashboard"],
    queryFn: async () => {
      try {
        const response = await api.get<Array<{ id: string; name: string }>>("/services");
        return response.data ?? [];
      } catch (error) {
        console.error("Erro ao buscar serviços:", error);
        return [];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutos - dados considerados "frescos"
    enabled: true,
    retry: 2,
    refetchOnMount: true,
  });

  // Buscar totais de serviços (incluindo cloud)
  const { data: serviceTotals } = useQuery({
    queryKey: ["serviceTotals", "dashboard"],
    queryFn: async () => {
      try {
        const response = await api.get<{ cloud: number }>("/stats/service-totals");
        return response.data;
      } catch (error) {
        console.error("Erro ao buscar totais de serviços:", error);
        return { cloud: 0 };
      }
    },
    staleTime: 60 * 1000,
  });

  // Combinar serviços de vendas com todos os serviços cadastrados
  const availableServices = useMemo(() => {
    const servicesMap = new Map<string, { key: string; name: string; group: "TV" | "SERVICO" }>();
    
    // Adicionar TODOS os serviços cadastrados
    if (allServices && Array.isArray(allServices)) {
      allServices.forEach((service: any) => {
        const serviceId = service.id || service.service_id;
        const serviceName = service.name || service.service_name;
        
        if (!serviceId || !serviceName) return;
        
        const serviceNameLower = String(serviceName).toLowerCase().trim();
        if (serviceNameLower === "tv" || serviceNameLower === "tv essencial" || serviceNameLower === "tv premium") {
          return;
        }
        
        servicesMap.set(serviceName, {
          key: `svc-${serviceId}`,
          name: serviceName,
          group: "SERVICO" as const,
        });
      });
    }
    
    // Atualizar com dados de vendas se existirem
    if (salesData.services && Array.isArray(salesData.services)) {
      salesData.services.forEach(s => {
        if (s.group !== "TV") {
          servicesMap.set(s.name, s);
        }
      });
    }
    
    return Array.from(servicesMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [salesData.services, allServices]);

  const activeServices = useMemo<SalesTimeseries["services"]>(() => {
    const services: SalesTimeseries["services"] = [];
    
    // Verificar se TV deve ser incluída (se não há filtro ou se foi explicitamente selecionada)
    const shouldIncludeTV = !selectedServiceKeys.length || selectedServiceKeys.includes("tv-total");
    
    // Adicionar serviço TV agregado (Essencial + Premium) se necessário
    if (shouldIncludeTV) {
      const tvEssencial = salesData.services.find((s) => s.key === "tv-essencial");
      const tvPremium = salesData.services.find((s) => s.key === "tv-premium");
      if (tvEssencial || tvPremium) {
        services.push({
          key: "tv-total",
          name: "TV (Essencial + Premium)",
          group: "TV" as const,
        });
      }
    }
    
    // Adicionar outros serviços não-TV
    const nonTvServices = availableServices.filter((service) => service.group !== "TV");
    
    if (!selectedServiceKeys.length) {
      // Se não há filtro, mostrar todos os serviços não-TV
      services.push(...nonTvServices);
    } else {
      // Filtrar apenas os serviços selecionados (exceto TV que já foi tratada acima)
      const filtered = nonTvServices.filter((service) => selectedServiceKeys.includes(service.key));
      services.push(...filtered);
    }
    
    return services;
  }, [availableServices, selectedServiceKeys, salesData.services]);

  // Identificar serviços de Telemedicina e Hub
  const telemedicinaKeywords = ["telemedicina", "tele", "telepet"];
  const hubKeywords = ["hub", "hubplay"];
  
  const isTelemedicinaService = (serviceName: string): boolean => {
    const name = serviceName.toLowerCase();
    return telemedicinaKeywords.some(keyword => name.includes(keyword));
  };
  
  const isHubService = (serviceName: string): boolean => {
    const name = serviceName.toLowerCase();
    return hubKeywords.some(keyword => name.includes(keyword));
  };

  // Calcular total arrecadado (TV Premium + TV Essencial + Telemedicina + Hub)
  const totalRevenue = useMemo(() => {
    if (!salesData.points || salesData.points.length === 0) return 0;
    
    let total = 0;
    salesData.points.forEach((point) => {
      // TV Essencial
      const tvEssencialValue = point.values?.["tv-essencial"] ?? 0;
      // TV Premium
      const tvPremiumValue = point.values?.["tv-premium"] ?? 0;
      
      // Telemedicina e Hub (buscar por nome do serviço)
      let telemedicinaValue = 0;
      let hubValue = 0;
      
      salesData.services.forEach((service) => {
        if (service.group === "SERVICO") {
          const serviceValue = point.values?.[service.key] ?? 0;
          if (isTelemedicinaService(service.name)) {
            telemedicinaValue += serviceValue;
          } else if (isHubService(service.name)) {
            hubValue += serviceValue;
          }
        }
      });
      
      total += tvEssencialValue + tvPremiumValue + telemedicinaValue + hubValue;
    });
    
    return total;
  }, [salesData.points, salesData.services]);

  // Calcular progresso em relação à meta (depois de totalRevenue ser definido)
  const revenueProgress = revenueGoal > 0 ? Math.min((totalRevenue / revenueGoal) * 100, 100) : 0;

  const lineChartData = useMemo(() => {
    return salesData.points.map((point) => {
      const entry: Record<string, number | string> = {
        month: point.label,
      };
      
      activeServices.forEach((service) => {
        if (service.key === "tv-total") {
          // Somar tv-essencial e tv-premium para a TV agregada (quantidade)
          const tvEssencialTotal = point.totals["tv-essencial"] ?? 0;
          const tvPremiumTotal = point.totals["tv-premium"] ?? 0;
          entry[service.key] = tvEssencialTotal + tvPremiumTotal;
        } else {
          entry[service.key] = point.totals[service.key] ?? 0;
        }
      });
      
      return entry;
    });
  }, [salesData.points, salesData.services, activeServices]);

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    if (endDate && value && value > endDate) {
      setEndDate(value);
    }
  };

  const handleEndDateChange = (value: string) => {
    if (startDate && value && value < startDate) {
      setEndDate(startDate);
      return;
    }
    setEndDate(value);
  };

  return (
    <VStack align="stretch" spacing={6}>
      <Heading size="lg">Visão geral inteligente</Heading>
      <Box>
        <VStack align="stretch" spacing={8}>
          <SimpleGrid columns={{ base: 1, md: 2, xl: 4 }} spacing={{ base: 4, md: 6 }}>
        {isLoading && data.metrics.all.total === 0 ? (
          Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} height="120px" borderRadius="2xl" />)
        ) : (
          <>
            <StatCard label="Total de CPFs" value={data.metrics.all.cpf} />
            <StatCard label="Total de CNPJs" value={data.metrics.all.cnpj} />
            <StatCard label="Total geral" value={data.metrics.all.total} />
            <StatCard label="Cadastros no último mês" value={data.metrics.all.lastMonth} />
          </>
        )}
          </SimpleGrid>

          {/* Card de Total Arrecadado e Meta */}
          <Box
            bg={cardBg}
            borderRadius="2xl"
            p={6}
            boxShadow="lg"
            borderWidth={1}
            borderColor={cardBorder}
          >
            <HStack justify="space-between" align={{ base: "stretch", md: "center" }} spacing={4} flexWrap="wrap" mb={4}>
              <Box>
                <Heading size="md">Total Arrecadado</Heading>
                <Text fontSize="sm" color={mutedText}>
                  Soma de valores: TV Premium + TV Essencial + Telemedicina + Hub
                </Text>
              </Box>
              <FormControl maxW={{ base: "full", sm: "200px" }}>
                <FormLabel fontSize="sm">Meta (R$)</FormLabel>
                <Input
                  type="number"
                  value={revenueGoal || ""}
                  onChange={(e) => handleGoalChange(e.target.value)}
                  placeholder="0,00"
                  step="0.01"
                  min="0"
                />
              </FormControl>
            </HStack>
            
            <VStack align="stretch" spacing={4}>
              <HStack justify="space-between" align="center">
                <Text fontSize="lg" color={mutedText}>Total Arrecadado</Text>
                <Text fontSize="3xl" fontWeight="bold" color="#10b981">
                  {formatCurrency(totalRevenue)}
                </Text>
              </HStack>
              
              {revenueGoal > 0 && (
                <>
                  <HStack justify="space-between" align="center">
                    <Text fontSize="sm" color={mutedText}>Meta</Text>
                    <Text fontSize="lg" fontWeight="semibold">
                      {formatCurrency(revenueGoal)}
                    </Text>
                  </HStack>
                  <Progress
                    value={revenueProgress}
                    colorScheme={revenueProgress >= 100 ? "green" : revenueProgress >= 75 ? "yellow" : "orange"}
                    borderRadius="full"
                    height="20px"
                    backgroundColor={useColorModeValue("gray.100", "gray.700")}
                  />
                  <HStack justify="space-between" align="center">
                    <Text fontSize="sm" color={mutedText}>Progresso</Text>
                    <Badge
                      colorScheme={revenueProgress >= 100 ? "green" : revenueProgress >= 75 ? "yellow" : "orange"}
                      borderRadius="full"
                      px={3}
                      py={1}
                      fontSize="sm"
                    >
                      {revenueProgress.toFixed(1)}%
                    </Badge>
                  </HStack>
                  {totalRevenue < revenueGoal && (
                    <Text fontSize="sm" color={mutedText} textAlign="center">
                      Faltam {formatCurrency(revenueGoal - totalRevenue)} para atingir a meta
                    </Text>
                  )}
                  {totalRevenue >= revenueGoal && (
                    <Text fontSize="sm" color="green.500" textAlign="center" fontWeight="semibold">
                      🎉 Meta atingida! Excedido em {formatCurrency(totalRevenue - revenueGoal)}
                    </Text>
                  )}
                </>
              )}
            </VStack>
          </Box>

          <Box
        bg={cardBg}
        borderRadius="2xl"
        p={6}
        boxShadow="lg"
        borderWidth={1}
        borderColor={cardBorder}
      >
        <Heading size="md">Meta de acessos de TV</Heading>
        <Text fontSize="sm" color={mutedText}>
          Progresso em direção à meta de 5.000 acessos simultâneos.
        </Text>

        <VStack align="stretch" spacing={4} mt={6}>
          <HStack justify="space-between">
            <Text color={mutedText}>Acessos utilizados</Text>
            <Text fontWeight="semibold">{data.tvUsage.used}</Text>
          </HStack>
          <Progress
            value={Math.min(data.tvUsage.percentage, 100)}
            colorScheme="brand"
            borderRadius="full"
            height="16px"
            backgroundColor={useColorModeValue("gray.100", "gray.700")}
          />
          <HStack justify="space-between">
            <Text color={mutedText}>Disponíveis</Text>
            <Text fontWeight="medium">{data.tvUsage.available}</Text>
          </HStack>
          <Box mt={2}>
            <Badge colorScheme="brand" borderRadius="full" px={3} py={1}>
              {data.tvUsage.percentage.toFixed(1)}% da meta atingida
            </Badge>
          </Box>
        </VStack>
          </Box>

          <Box
        bg={cardBg}
        borderRadius="2xl"
        p={6}
        boxShadow="lg"
        borderWidth={1}
        borderColor={cardBorder}
      >
        <HStack justify="space-between" align={{ base: "stretch", md: "center" }} spacing={4} flexWrap="wrap">
          <Box>
            <Heading size="md">Distribuição de cadastros</Heading>
            <Text fontSize="sm" color={mutedText}>
              Compare documentações de acordo com o plano selecionado em tempo real.
            </Text>
          </Box>
          <Select value={selectedSegmentKey} onChange={(event) => setSelectedSegmentKey(event.target.value)} maxW={{ base: "full", sm: "220px" }}>
            {segmentOptions.map((segment) => (
              <option key={segment.key} value={segment.key}>
                {segment.label}
              </option>
            ))}
          </Select>
        </HStack>

        <Box w="full" h={{ base: "260px", md: "320px" }} mt={6}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
              <XAxis dataKey="label" stroke="currentColor" />
              <YAxis allowDecimals={false} stroke="currentColor" />
              <Tooltip cursor={{ fill: "rgba(79, 70, 229, 0.08)" }} />
              <Legend />
              <Bar dataKey="value" name="Cadastros" fill="#4c51bf" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
          </Box>

          <Box
        bg={cardBg}
        borderRadius="2xl"
        p={6}
        boxShadow="lg"
        borderWidth={1}
        borderColor={cardBorder}
      >
        <Heading size="md">Vendas mensais por serviço</Heading>
        <Text fontSize="sm" color={mutedText}>
          Analise o desempenho ao longo do ano filtrando por serviço e intervalo de datas.
        </Text>

        <Stack
          direction={{ base: "column", md: "row" }}
          spacing={4}
          mt={6}
          align={{ base: "stretch", md: "flex-end" }}
        >
          <FormControl maxW={{ base: "full", md: "220px" }}>
            <FormLabel fontSize="sm">Data inicial</FormLabel>
            <Input type="date" value={startDate} onChange={(event) => handleStartDateChange(event.target.value)} />
          </FormControl>
          <FormControl maxW={{ base: "full", md: "220px" }}>
            <FormLabel fontSize="sm">Data final</FormLabel>
            <Input type="date" value={endDate} onChange={(event) => handleEndDateChange(event.target.value)} />
          </FormControl>
        </Stack>

        <Box mt={6}>
          <Text fontSize="sm" color={mutedText} mb={2}>
            Filtrar tipos de serviço
          </Text>
          <CheckboxGroup value={selectedServiceKeys} onChange={(values) => setSelectedServiceKeys(values as string[])}>
            <Wrap spacing={3}>
              {/* Adicionar checkbox para TV agregada */}
              <WrapItem key="tv-total">
                <Checkbox value="tv-total">TV (Essencial + Premium)</Checkbox>
              </WrapItem>
              {/* Adicionar outros serviços */}
              {availableServices
                .filter((service) => service.group !== "TV")
                .map((service) => (
                  <WrapItem key={service.key}>
                    <Checkbox value={service.key}>{service.name}</Checkbox>
                  </WrapItem>
                ))}
            </Wrap>
          </CheckboxGroup>
        </Box>

        <Box w="full" h={{ base: "260px", md: "340px" }} mt={8}>
          {loadingSales && lineChartData.length === 0 ? (
            <Skeleton height="100%" borderRadius="xl" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineChartData}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" stroke="currentColor" />
                <YAxis allowDecimals={false} stroke="currentColor" />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Legend />
                {activeServices.map((service, index) => (
                  <Line
                    key={service.key}
                    type="monotone"
                    dataKey={service.key}
                    name={service.name}
                    stroke={SALES_COLORS[index % SALES_COLORS.length]}
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={!fetchingSales}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </Box>
        <Text fontSize="sm" color={mutedText} mt={4}>
          Total de vendas no período: <strong>{salesData.totalSales}</strong>
        </Text>
          </Box>

          <Box
        bg={cardBg}
        borderRadius="2xl"
        p={6}
        boxShadow="lg"
        borderWidth={1}
        borderColor={cardBorder}
      >
        <Heading size="md">Resumo por serviços</Heading>
        <Text fontSize="sm" color={mutedText}>
          Veja quantos clientes estão vinculados a cada oferta ativa.
        </Text>

        <SimpleGrid columns={{ base: 1, md: 3, xl: 4 }} spacing={4} mt={6}>
          {loadingSales || isLoadingAllServices ? (
            <Text color={mutedText} gridColumn="1 / -1" textAlign="center" py={4}>
              Carregando serviços...
            </Text>
          ) : (
            <>
              {/* Card de TV */}
              <Box borderWidth={1} borderColor={cardBorder} bg={listBg} p={4} borderRadius="xl">
            <HStack justify="space-between" mb={2}>
              <Text fontWeight="semibold">TV (Essencial + Premium)</Text>
              <Badge colorScheme="teal" borderRadius="full">
                TV
              </Badge>
            </HStack>
            <Text fontSize="sm" color={mutedText}>
              Acessos ativos
            </Text>
            <Text fontSize="2xl" fontWeight="bold" color="brand.600">
              {data.planSummary.reduce((acc, item) => acc + item.slots, 0)}
            </Text>

            <Button
              size="sm"
              variant="ghost"
              mt={4}
              onClick={() => setIsTvBreakdownOpen((prev) => !prev)}
              colorScheme="brand"
            >
              {isTvBreakdownOpen ? "Ocultar detalhes" : "Ver detalhes"}
            </Button>
            <Collapse in={isTvBreakdownOpen} animateOpacity>
              <VStack align="stretch" spacing={2} mt={4}>
                {data.planSummary.map((item) => (
                  <HStack key={item.plan} justify="space-between" fontSize="sm">
                    <Text color={mutedText}>{item.plan === "ESSENCIAL" ? "TV Essencial" : "TV Premium"}</Text>
                    <Text fontWeight="semibold">{item.slots} acessos</Text>
                  </HStack>
                ))}
              </VStack>
            </Collapse>
              </Box>

              {/* Card de Cloud */}
              <Box borderWidth={1} borderColor={cardBorder} bg={listBg} p={4} borderRadius="xl">
                <HStack justify="space-between" mb={2}>
                  <Text fontWeight="semibold">Cloud</Text>
                  <Badge colorScheme="blue" borderRadius="full">
                    Cloud
                  </Badge>
                </HStack>
                <Text fontSize="sm" color={mutedText}>
                  Usuários ativos
                </Text>
                <Text fontSize="2xl" fontWeight="bold" color="brand.600">
                  {serviceTotals?.cloud ?? (data as any).cloudAccesses ?? 0}
                </Text>
              </Box>

              {/* Outros serviços */}
              {availableServices
                .filter((service) => service.group !== "TV")
                .map((service) => {
                  const salesTotals = salesData.points.reduce((acc, point) => acc + (point.totals[service.key] ?? 0), 0);
                  return (
                    <Box key={service.key} borderWidth={1} borderColor={cardBorder} bg={listBg} p={4} borderRadius="xl">
                      <HStack justify="space-between" mb={2}>
                        <Text fontWeight="semibold">{service.name}</Text>
                        <Badge colorScheme="blue" borderRadius="full">
                          Serviço
                        </Badge>
                      </HStack>
                      <Text fontSize="sm" color={mutedText}>
                        Clientes referenciados
                      </Text>
                      <Text fontSize="2xl" fontWeight="bold" color="brand.600">
                        {salesTotals}
                      </Text>
                    </Box>
                  );
                })}
            </>
          )}
        </SimpleGrid>
          </Box>
        </VStack>
      </Box>
    </VStack>
  );
}

