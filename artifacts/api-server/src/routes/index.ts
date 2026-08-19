import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import playersRouter from "./players";
import gamesRouter from "./games";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";
import storageRouter from "./storage";
import teamMediaRouter from "./team-media";
import febRouter from "./feb";
import adminSyncRouter from "./admin-sync.routes.js";
import authRouter from "./auth.routes.js";
import seasonsRouter from "./seasons.js";
import ligasRouter from "./ligas.js";
import imageProxyRouter from "./image-proxy.js";
import scoutingReportsRouter from "./scouting-reports.routes.js";
import playsRouter from "./plays.js";
import { requireAuth } from "../lib/auth.middleware.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use("/auth", authRouter);

// Everything below this line is application data. Keep only health, explicitly
// public object assets, and basic authentication above this guard.
router.use(requireAuth);

router.use(imageProxyRouter);
router.use(dashboardRouter);
router.use(ligasRouter);
router.use(teamsRouter);
router.use(teamMediaRouter);
router.use(playersRouter);
router.use(gamesRouter);
router.use(reportsRouter);
router.use(scoutingReportsRouter);
router.use(playsRouter);
router.use(febRouter);
router.use(seasonsRouter);
router.use("/admin/sync", adminSyncRouter);

export default router;
