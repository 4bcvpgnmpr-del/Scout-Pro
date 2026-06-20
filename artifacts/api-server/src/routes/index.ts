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

const router: IRouter = Router();

router.use(healthRouter);
router.use(storageRouter);
router.use(dashboardRouter);
router.use(teamsRouter);
router.use(teamMediaRouter);
router.use(playersRouter);
router.use(gamesRouter);
router.use(reportsRouter);
router.use(febRouter);
router.use("/admin/sync", adminSyncRouter);
router.use("/auth", authRouter);

export default router;
