"use client";

import {
  Box,
  Flex,
  Icon,
  Link as ChakraLink,
  Text,
  VStack,
  useColorModeValue,
  Image,
  HStack,
  IconButton,
  useColorMode,
  useBreakpointValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  Tooltip,
} from "@chakra-ui/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  FiHome,
  FiUsers,
  FiFileText,
  FiLayers,
  FiBookOpen,
  FiSettings,
  FiMonitor,
  FiMoon,
  FiSun,
  FiUser,
  FiLogOut,
  FiCloud,
  FiShield,
  FiPieChart,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { FaPlayCircle } from "react-icons/fa";
import { MdMedicalServices } from "react-icons/md";
import { IconType } from "react-icons";
import { useAuth } from "@/context/AuthContext";

const baseLinks: Array<{ label: string; to: string; icon: IconType }> = [
  { label: "Dashboard", to: "/dashboard", icon: FiHome },
  { label: "Clientes", to: "/clientes", icon: FiUsers },
  { label: "Usuários TV", to: "/usuarios", icon: FiMonitor },
  { label: "Usuários Cloud", to: "/usuarios-cloud", icon: FiCloud },
  { label: "Usuários Hub", to: "/usuarios-hub", icon: FaPlayCircle },
  { label: "Usuários Tele", to: "/usuarios-tele", icon: MdMedicalServices },
  { label: "Relatórios", to: "/relatorios/servicos", icon: FiPieChart },
  { label: "Serviços", to: "/servicos", icon: FiSettings },
  { label: "Contratos", to: "/contratos", icon: FiFileText },
  { label: "Templates", to: "/templates", icon: FiLayers },
  { label: "Guia de uso", to: "/guia", icon: FiBookOpen },
];

interface SidebarProps {
  onNavigate?: () => void;
  isMobile?: boolean;
}

export function Sidebar({ onNavigate, isMobile = false }: SidebarProps) {
  const { isAdmin, user, signOut } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  // No mobile, sempre expandido. No desktop, pode ser colapsado
  const [isCollapsed, setIsCollapsed] = useState(false);
  const shouldCollapse = !isMobile && isCollapsed;
  const activeBg = useColorModeValue("brand.100", "brand.700");
  const activeColor = useColorModeValue("brand.600", "brand.100");
  const defaultLinkColor = useColorModeValue("gray.600", "gray.300");
  const hoverBg = useColorModeValue("rgba(226, 232, 240, 0.6)", "rgba(255, 255, 255, 0.08)");
  const hoverColor = useColorModeValue("gray.800", "white");
  const subtitleColor = useColorModeValue("gray.500", "gray.400");
  const containerBg = "transparent";
  const borderColor = "transparent";
  const pathname = usePathname();
  const metadata = (user?.user_metadata ?? {}) as { name?: string; role?: string };
  const displayName = metadata.name ?? (metadata.role ? metadata.role.charAt(0).toUpperCase() + metadata.role.slice(1) : user?.user_metadata?.role ?? "Usuário");

  return (
    <Box
      as="nav"
      w={{ base: "full", md: shouldCollapse ? 20 : 72 }}
      bg={containerBg}
      borderRightWidth={0}
      borderColor={borderColor}
      h={{ base: "full", md: "100vh" }}
      px={{ base: 5, md: shouldCollapse ? 2 : 6 }}
      py={{ base: 6, md: 10 }}
      overflow="hidden"
      borderRadius={{ base: 0, md: "2xl" }}
      backdropFilter="blur(8px)"
      display="flex"
      flexDirection="column"
      transition="width 0.3s ease, padding 0.3s ease"
      position="relative"
    >
      {/* Botão de colapsar/expandir - apenas no desktop */}
      {!isMobile && (
        <IconButton
          aria-label={isCollapsed ? "Expandir menu" : "Colapsar menu"}
          icon={<Icon as={isCollapsed ? FiChevronRight : FiChevronLeft} />}
          onClick={() => setIsCollapsed(!isCollapsed)}
          variant="ghost"
          size="sm"
          position="absolute"
          top={4}
          right={2}
          zIndex={10}
        />
      )}

      <Flex align="center" mb={10} gap={4} display={shouldCollapse ? "none" : "flex"}>
        <Box w={{ base: 14, md: 16 }} h={{ base: 14, md: 16 }} borderRadius="2xl" overflow="hidden" boxShadow="lg" flexShrink={0}>
          <Image src="/assets/logo.png" alt="Serviços Telefonia" w="full" h="full" objectFit="cover" />
        </Box>
        {!shouldCollapse && (
          <Box>
            <Text fontWeight="bold" fontSize={{ base: "lg", md: "xl" }}>
              Serviços Telefonia
            </Text>
            <Text fontSize={{ base: "sm", md: "md" }} color={subtitleColor}>
              Central administrativa
            </Text>
          </Box>
        )}
      </Flex>

      <VStack 
        align="stretch" 
        spacing={2} 
        flex={1} 
        overflowY={{ base: "auto", md: "auto" }}
        minH={0}
        pr={2}
        css={{
          '&::-webkit-scrollbar': {
            display: 'none',
          },
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        {[...baseLinks, ...(isAdmin ? [{ label: "Administração", to: "/admin/usuarios", icon: FiShield }] : [])].map((link) => {
          const isActive = pathname === link.to;
          const linkContent = (
            <Flex
              align="center"
              px={4}
              py={3}
              borderRadius="xl"
              bg={isActive ? activeBg : "transparent"}
              color={isActive ? activeColor : defaultLinkColor}
              fontWeight={isActive ? "semibold" : "medium"}
              gap={3}
              transition="transform 0.25s ease, background-color 0.25s ease"
              _hover={{
                bg: isActive ? activeBg : hoverBg,
                color: isActive ? activeColor : hoverColor,
                transform: "translateX(4px)",
              }}
              _active={{ transform: "scale(0.97)" }}
              justify={shouldCollapse ? "center" : "flex-start"}
            >
              <Icon as={link.icon} boxSize={5} />
              {!shouldCollapse && <Text>{link.label}</Text>}
            </Flex>
          );

          return (
            <ChakraLink
              key={link.to}
              as={Link}
              href={link.to}
              style={{ textDecoration: "none" }}
              onClick={onNavigate}
              _hover={{ textDecoration: "none" }}
            >
              {shouldCollapse ? (
                <Tooltip label={link.label} placement="right" hasArrow>
                  {linkContent}
                </Tooltip>
              ) : (
                linkContent
              )}
            </ChakraLink>
          );
        })}

        {/* Separador visual */}
        <Box h="1px" bg={useColorModeValue("gray.200", "gray.700")} my={2} />

        {/* Controles de usuário e tema - dentro do scroll */}
        {/* Botão de alternar tema */}
        {shouldCollapse ? (
          <Tooltip label={colorMode === "light" ? "Modo escuro" : "Modo claro"} placement="right" hasArrow>
            <IconButton
              aria-label="Alternar modo de cor"
              icon={colorMode === "light" ? <FiMoon /> : <FiSun />}
              onClick={toggleColorMode}
              variant="ghost"
              w="full"
              justifyContent="center"
              px={4}
              py={3}
            />
          </Tooltip>
        ) : (
          <Button
            aria-label="Alternar modo de cor"
            onClick={toggleColorMode}
            variant="ghost"
            w="full"
            justifyContent="flex-start"
            leftIcon={<Icon as={colorMode === "light" ? FiMoon : FiSun} />}
            px={4}
            py={3}
            borderRadius="xl"
            color={defaultLinkColor}
            fontWeight="medium"
            gap={3}
            transition="transform 0.25s ease, background-color 0.25s ease"
            _hover={{
              bg: hoverBg,
              color: hoverColor,
              transform: "translateX(4px)",
            }}
            _active={{ transform: "scale(0.97)" }}
          >
            {colorMode === "light" ? "Modo escuro" : "Modo claro"}
          </Button>
        )}

        {/* Menu do usuário */}
        <Menu placement={shouldCollapse ? "right" : isMobile ? "bottom" : "top-end"}>
          <MenuButton
            as={Button}
            variant="solid"
            borderRadius="xl"
            leftIcon={<FiUser />}
            colorScheme="brand"
            size="sm"
            w="full"
            justifyContent={shouldCollapse ? "center" : "flex-start"}
            px={shouldCollapse ? 0 : 4}
            py={3}
            fontWeight="medium"
            transition="transform 0.25s ease, background-color 0.25s ease"
            _hover={{
              transform: "translateX(4px)",
            }}
            _active={{ transform: "scale(0.97)" }}
          >
            {!shouldCollapse && displayName}
          </MenuButton>
          <MenuList>
            <MenuItem icon={<FiUser />} as={Link} href="/perfil" onClick={onNavigate}>
              Meu perfil
            </MenuItem>
            {isAdmin && (
              <MenuItem icon={<FiShield />} as={Link} href="/admin/usuarios" onClick={onNavigate}>
                Administração
              </MenuItem>
            )}
            <MenuItem icon={<FiLogOut />} onClick={signOut}>
              Sair
            </MenuItem>
          </MenuList>
        </Menu>
      </VStack>
    </Box>
  );
}





