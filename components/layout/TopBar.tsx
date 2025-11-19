"use client";

import {
  Box,
  Flex,
  HStack,
  IconButton,
  Text,
  useColorMode,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Button,
  useBreakpointValue,
} from "@chakra-ui/react";
import { FiMenu, FiMoon, FiSun, FiUser, FiLogOut, FiShield } from "react-icons/fi";
import { useAuth } from "@/context/AuthContext";
import Link from "next/link";

interface TopBarProps {
  onOpenMenu: () => void;
}

export function TopBar({ onOpenMenu }: TopBarProps) {
  const { colorMode, toggleColorMode } = useColorMode();
  const subtitleColor = useColorModeValue("gray.500", "gray.400");
  const { user, signOut, isAdmin } = useAuth();
  const metadata = (user?.user_metadata ?? {}) as { name?: string; role?: string };
  const displayName =
    metadata.name ??
    (metadata.role
      ? metadata.role.charAt(0).toUpperCase() + metadata.role.slice(1)
      : user?.user_metadata?.role ?? "Usuário");
  const showCompactActions = useBreakpointValue({ base: true, md: true });

  return (
    <Flex
      position="relative"
      px={{ base: 4, md: 10 }}
      py={{ base: 4, md: 6 }}
      align="center"
      justify="space-between"
      bg="transparent"
      borderBottomWidth={0}
      width="100%"
    >
      <HStack spacing={4}>
        <IconButton
          aria-label="Abrir menu"
          icon={<FiMenu />}
          display={{ base: "inline-flex", md: "none" }}
          onClick={onOpenMenu}
          variant="ghost"
        />
        <Box>
          <Text fontSize="lg" fontWeight="semibold">
            Bem-vindo(a) à central inteligente
          </Text>
          <Text fontSize="sm" color={subtitleColor}>
            Acompanhe clientes, contratos e linhas em tempo real.
          </Text>
        </Box>
      </HStack>

      {showCompactActions && (
        <HStack spacing={3}>
          <IconButton
            aria-label="Alternar modo de cor"
            icon={colorMode === "light" ? <FiMoon /> : <FiSun />}
            onClick={toggleColorMode}
            variant="ghost"
          />
          <Menu placement="bottom-end">
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
              <MenuItem icon={<FiUser />} as={Link} href="/perfil">
                Meu perfil
              </MenuItem>
              {isAdmin && (
                <MenuItem icon={<FiShield />} as={Link} href="/admin/usuarios">
                  Administração
                </MenuItem>
              )}
              <MenuItem icon={<FiLogOut />} onClick={signOut}>
                Sair
              </MenuItem>
            </MenuList>
          </Menu>
        </HStack>
      )}
    </Flex>
  );
}





