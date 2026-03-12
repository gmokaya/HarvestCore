import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usersRouter from "./users";
import inventoryRouter from "./inventory";
import inspectionRouter from "./inspection";
import receiptsRouter from "./receipts";
import tokensRouter from "./tokens";
import loansRouter from "./loans";
import marketplaceRouter from "./marketplace";
import settlementRouter from "./settlement";
import dashboardRouter from "./dashboard";
import ewrsRouter from "./ewrs";

const router: IRouter = Router();

router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/users", usersRouter);
router.use("/inventory", inventoryRouter);
router.use("/inspections", inspectionRouter);
router.use("/receipts", receiptsRouter);
router.use("/tokens", tokensRouter);
router.use("/loans", loansRouter);
router.use("/marketplace", marketplaceRouter);
router.use("/settlement", settlementRouter);
router.use("/dashboard", dashboardRouter);
router.use("/ewrs", ewrsRouter);

export default router;
