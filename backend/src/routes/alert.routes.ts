import { Router } from "express";
import {
  createAlertChannel,
  listAlertChannels,
} from "../controllers/alert.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(listAlertChannels));
router.post("/", asyncHandler(createAlertChannel));

export default router;
