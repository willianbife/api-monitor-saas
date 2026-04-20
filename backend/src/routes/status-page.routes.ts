import { Router } from "express";
import {
  getStatusPage,
  updateStatusPage,
} from "../controllers/status-page.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/public/:slug", asyncHandler(getStatusPage));
router.put("/", requireAuth, asyncHandler(updateStatusPage));

export default router;
