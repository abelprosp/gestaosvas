"use client";

import {
  Box,
  Drawer,
  DrawerContent,
  useDisclosure,
  Flex,
  useColorModeValue,
} from "@chakra-ui/react";
import { PropsWithChildren } from "react";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { VirtualAssistantChat } from "@/components/chat/VirtualAssistantChat";

export function AppLayout({ children }: PropsWithChildren) {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const drawerBg = useColorModeValue("white", "gray.900");
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
      <Drawer placement="left" onClose={onClose} isOpen={isOpen} size="xs">
        <DrawerContent bg={drawerBg}>
          <Sidebar onNavigate={onClose} />
        </DrawerContent>
      </Drawer>

      <Flex flex={1} direction="column" bg="transparent">
        <TopBar onOpenMenu={onOpen} />
        <Flex flex={1}>
          <Box display={{ base: "none", md: "block" }}>
            <Sidebar />
          </Box>
          <Box
            as="main"
            flex={1}
            px={{ base: 3, md: 6 }}
            pt={{ base: 20, md: 24 }}
            pb={{ base: 6, md: 10 }}
            bg="transparent"
            borderRadius={{ base: 0, lg: "2xl" }}
            boxShadow="none"
            borderWidth="0"
            maxW="1440px"
            mx="auto"
            width="100%"
          >
            {children}
          </Box>
        </Flex>
      </Flex>
      <VirtualAssistantChat />
    </Flex>
  );
}


