import { Router } from "express";
import { asyncHandler } from "../middlewares/async.middleware";
import { liveness, openApiSpec, readiness } from "../controllers/ops.controller";

const router = Router();

router.get("/live", asyncHandler(liveness));
router.get("/ready", asyncHandler(readiness));
router.get("/openapi.json", asyncHandler(openApiSpec));

export default router;
