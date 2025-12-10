"use client";

import {
  Box,
  Drawer,
  DrawerContent,
  useDisclosure,
  Flex,
  useColorModeValue,
  IconButton,
} from "@chakra-ui/react";
import { PropsWithChildren } from "react";
import { Sidebar } from "./Sidebar";
import { VirtualAssistantChat } from "@/components/chat/VirtualAssistantChat";
import { useProactiveAlerts } from "@/hooks/useProactiveAlerts";
import { useAuth } from "@/context/AuthContext";
import { FiMenu, FiX } from "react-icons/fi";

export function AppLayout({ children }: PropsWithChildren) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const drawerBg = useColorModeValue("white", "gray.900");
  const { user } = useAuth();
  
  // Ativar alertas proativos apenas quando o usuário estiver autenticado
  useProactiveAlerts(!!user);
  const backgroundImage = useColorModeValue(
    "/assets/bg-light.png",
    "/assets/bg-dark.png"
  );

  const backgroundStyles = {
    bgImage: backgroundImage,
    bgSize: { base: "cover", md: "100% 100%" },
    bgAttachment: { base: "scroll", md: "fixed" } as const,
    bgRepeat: "no-repeat" as const,
    bgPosition: "center",
    backgroundColor: useColorModeValue("#e6f1ff", "#010917"),
  };

  return (
    <Flex
      minH="100vh"
      transition="background-color 0.2s ease"
      pt={0}
      {...backgroundStyles}
    >
      <Drawer placement="left" onClose={onClose} isOpen={isOpen} size="sm">
        <DrawerContent bg={drawerBg}>
          <Sidebar onNavigate={onClose} isMobile={true} />
        </DrawerContent>
      </Drawer>

      <Flex flex={1} direction="column" bg="transparent">
        {/* Header mobile com botão de menu */}
        <Flex
          display={{ base: "flex", md: "none" }}
          position="sticky"
          top={0}
          zIndex={100}
          bg={useColorModeValue("rgba(255,255,255,0.9)", "rgba(15, 23, 42, 0.9)")}
          backdropFilter="blur(10px)"
          borderBottomWidth={1}
          borderColor={useColorModeValue("gray.200", "gray.700")}
          px={4}
          py={3}
          align="center"
          justify="flex-start"
          minH="60px"
        >
          <IconButton
            aria-label={isOpen ? "Fechar menu" : "Abrir menu"}
            icon={isOpen ? <FiX /> : <FiMenu />}
            onClick={isOpen ? onClose : onOpen}
            variant="ghost"
            size="md"
            mr={2}
          />
        </Flex>

        <Flex flex={1} minH="0">
          <Box 
            display={{ base: "none", md: "block" }}
            h="100vh"
            position="sticky"
            top={0}
            alignSelf="flex-start"
            zIndex={100}
            style={{ isolation: 'isolate' }}
          >
            <Sidebar isMobile={false} />
          </Box>
          <Box
            as="main"
            flex={1}
            px={{ base: 4, md: 6 }}
            pt={{ base: 4, md: 6 }}
            pb={{ base: 6, md: 10 }}
            bg="transparent"
            borderRadius={{ base: 0, lg: "2xl" }}
            boxShadow="none"
            borderWidth="0"
            maxW="1440px"
            mx="auto"
            width="100%"
            overflowX="hidden"
            position="relative"
            zIndex={1}
          >
            {children}
          </Box>
        </Flex>
      </Flex>
      <VirtualAssistantChat />
    </Flex>
  );
}


