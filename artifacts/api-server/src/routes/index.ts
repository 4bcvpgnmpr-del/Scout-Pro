import { Router, type IRouter } from "express";
import healthRouter from "./health";
import teamsRouter from "./teams";
import playersRouter from "./players";
import gamesRouter from "./games";
import reportsRouter from "./reports";
import dashboardRouter from "./dashboard";

const router: IRouter = Router();

router.use(healthRouter);
router.use(dashboardRouter);
router.use(teamsRouter);
router.use(playersRouter);
router.use(gamesRouter);
router.use(reportsRouter);

export default router;
