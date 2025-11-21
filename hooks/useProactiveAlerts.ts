"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@chakra-ui/react";
import { getProactiveSuggestions, type ProactiveSuggestion } from "@/lib/api/assistant";

const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos
const ALERT_COOLDOWN = 30 * 60 * 1000; // 30 minutos entre alertas do mesmo tipo

type AlertKey = string;
const lastAlertTime = new Map<AlertKey, number>();

export function useProactiveAlerts(enabled: boolean = true) {
  const toast = useToast();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const checkAlerts = async () => {
      try {
        const suggestions = await getProactiveSuggestions();
        const now = Date.now();

        // Filtrar apenas alertas críticos (warnings)
        const criticalAlerts = suggestions.filter((s) => s.type === "warning");

        criticalAlerts.forEach((suggestion: ProactiveSuggestion) => {
          const alertKey: AlertKey = suggestion.title;
          const lastTime = lastAlertTime.get(alertKey) || 0;

          // Só exibe alerta se passou o cooldown
          if (now - lastTime > ALERT_COOLDOWN) {
            lastAlertTime.set(alertKey, now);

            toast({
              title: suggestion.title,
              description: suggestion.description,
              status: "warning",
              duration: 8000,
              isClosable: true,
              position: "top-right",
            });
          }
        });
      } catch (error) {
        console.error("Erro ao verificar alertas proativos:", error);
      }
    };

    // Verificar imediatamente e depois periodicamente
    checkAlerts();
    intervalRef.current = setInterval(checkAlerts, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, toast]);
}

