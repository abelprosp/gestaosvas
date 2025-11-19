import "dotenv/config";
import express from "express";
import cors from "cors";
import router from "./routes";
import { errorHandler } from "./middleware/errorHandler";
import { ensureDefaultAdmin } from "./utils/bootstrapAdmin";
import { bootstrapTvAccounts } from "./utils/bootstrapTvAccounts";
import { randomizeAllTvPasswords } from "./services/tvAssignments";
import { bootstrapDefaultServices } from "./utils/bootstrapDefaultServices";

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api", router);

app.use((req, res) => {
  res.status(404).json({ message: "Rota não encontrada" });
});

app.use(errorHandler);

const port = process.env.PORT ?? 4000;

(async () => {
  await ensureDefaultAdmin();
  await bootstrapDefaultServices();
  await bootstrapTvAccounts();
  await randomizeAllTvPasswords();

  app.listen(port, () => {
    console.log(`API rodando em http://localhost:${port}`);
  });
})();

