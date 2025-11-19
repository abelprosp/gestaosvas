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
} from "@chakra-ui/react";
import { NavLink, useLocation, Link as RouterLink } from "react-router-dom";
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
} from "react-icons/fi";
import { FaPlayCircle } from "react-icons/fa";
import { MdMedicalServices } from "react-icons/md";
import { IconType } from "react-icons";
import logoAsset from "../../assets/logo.png";
import { useAuth } from "../../context/AuthContext";

const baseLinks: Array<{ label: string; to: string; icon: IconType }> = [
  { label: "Dashboard", to: "/", icon: FiHome },
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
}

export function Sidebar({ onNavigate }: SidebarProps) {
  const { isAdmin, user, signOut } = useAuth();
  const { colorMode, toggleColorMode } = useColorMode();
  const activeBg = useColorModeValue("brand.100", "brand.700");
  const activeColor = useColorModeValue("brand.600", "brand.100");
  const defaultLinkColor = useColorModeValue("gray.600", "gray.300");
  const hoverBg = useColorModeValue("rgba(226, 232, 240, 0.6)", "rgba(255, 255, 255, 0.08)");
  const hoverColor = useColorModeValue("gray.800", "white");
  const subtitleColor = useColorModeValue("gray.500", "gray.400");
  const containerBg = "transparent";
  const borderColor = "transparent";
  const location = useLocation();
  const showCompactHeaderActions = useBreakpointValue({ base: false, md: false });
  const metadata = (user?.user_metadata ?? {}) as { name?: string; role?: string };
  const displayName = metadata.name ?? (metadata.role ? metadata.role.charAt(0).toUpperCase() + metadata.role.slice(1) : user?.user_metadata?.role ?? "Usuário");

  return (
    <Box
      as="nav"
      w={{ base: "full", md: 72 }}
      bg={containerBg}
      borderRightWidth={0}
      borderColor={borderColor}
      h="full"
      maxH="100vh"
      px={{ base: 5, md: 6 }}
      py={{ base: 6, md: 10 }}
      overflow="hidden"
      borderRadius={{ base: 0, md: "2xl" }}
      backdropFilter="blur(8px)"
      display="flex"
      flexDirection="column"
    >
      <Flex align="center" mb={10} gap={4}>
        <Box w={{ base: 14, md: 16 }} h={{ base: 14, md: 16 }} borderRadius="2xl" overflow="hidden" boxShadow="lg" flexShrink={0}>
          <Image src={logoAsset} alt="Serviços Telefonia" w="full" h="full" objectFit="cover" />
        </Box>
        <Box>
          <Text fontWeight="bold" fontSize={{ base: "lg", md: "xl" }}>
            Serviços Telefonia
          </Text>
          <Text fontSize={{ base: "sm", md: "md" }} color={subtitleColor}>
            Central administrativa
          </Text>
        </Box>
      </Flex>

      <VStack align="stretch" spacing={2} flex={1} overflowY="auto" pr={2}>
        {[...baseLinks, ...(isAdmin ? [{ label: "Administração", to: "/admin/usuarios", icon: FiShield }] : [])].map((link) => {
          const isActive = location.pathname === link.to;
          return (
            <ChakraLink
              key={link.to}
              as={NavLink}
              to={link.to}
              style={{ textDecoration: "none" }}
              onClick={onNavigate}
              _hover={{ textDecoration: "none" }}
            >
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
              >
                <Icon as={link.icon} boxSize={5} />
                <Text>{link.label}</Text>
              </Flex>
            </ChakraLink>
          );
        })}
      </VStack>
      {showCompactHeaderActions ? (
        <HStack mt={6} justify="space-between" display={{ base: "flex", md: "none" }}>
          <IconButton
            aria-label="Alternar modo de cor"
            icon={colorMode === "light" ? <FiMoon /> : <FiSun />}
            onClick={toggleColorMode}
            variant="ghost"
          />
          <Menu placement="top-end">
            <MenuButton
              as={Button}
              variant="solid"
              borderRadius="full"
              leftIcon={<FiUser />}
              colorScheme="brand"
              size="sm"
            >
              {displayName}
            </MenuButton>
            <MenuList>
              <MenuItem icon={<FiUser />} as={RouterLink} to="/perfil" onClick={onNavigate}>
                Meu perfil
              </MenuItem>
              {isAdmin && (
                <MenuItem icon={<FiShield />} as={RouterLink} to="/admin/usuarios" onClick={onNavigate}>
                  Administração
                </MenuItem>
              )}
              <MenuItem icon={<FiLogOut />} onClick={signOut}>
                Sair
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      ) : null}
    </Box>
  );
}

