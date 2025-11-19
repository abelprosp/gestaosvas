export type ZapsignPayload = {
  title: string;
  contractId: string;
  clientName: string;
  clientEmail: string;
};

export async function sendToZapsign({
  contractId,
  title,
  clientName,
}: ZapsignPayload) {
  await delay(500);
  const externalId = `zap-${contractId}`;
  const signUrl = `https://app.zapsign.com/simulator/${contractId}`;
  const message = `Contrato '${title}' enviado para ${clientName}`;

  return { externalId, signUrl, message };
}

export async function waitForSignatureSimulation(contractId: string) {
  await delay(500);
  return {
    contractId,
    status: "SIGNED" as const,
    message: "Assinatura simulada concluída",
  };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}










