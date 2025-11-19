import { Router } from "express";
import clientsRouter from "./clients";
import templatesRouter from "./templates";
import contractsRouter from "./contracts";
import statsRouter from "./stats";
import adminUsersRouter from "./adminUsers";
import servicesRouter from "./services";
import tvRouter from "./tv";
import usersRouter from "./users";
import requestsRouter from "./requests";
import assistantRouter from "./assistant";
import { requireAdmin, requireAuth } from "../middleware/auth";
import cloudRouter from "./cloud";
import reportsRouter from "./reports";

const router = Router();

router.use("/admin/users", requireAuth, requireAdmin, adminUsersRouter);

router.use("/clients", requireAuth, clientsRouter);
router.use("/templates", requireAuth, templatesRouter);
router.use("/contracts", requireAuth, contractsRouter);
router.use("/stats", requireAuth, statsRouter);
router.use("/services", requireAuth, servicesRouter);
router.use("/tv", requireAuth, tvRouter);
router.use("/cloud", requireAuth, cloudRouter);
router.use("/users", requireAuth, usersRouter);
router.use("/requests", requireAuth, requestsRouter);
router.use("/reports", requireAuth, reportsRouter);
router.use("/assistant", assistantRouter);

export default router;

