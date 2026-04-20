import { Router } from "express";
import {
  createAlertChannel,
  listAlertChannels,
} from "../controllers/alert.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  methodNotAllowed,
  requireJsonContentType,
} from "../middlewares/request-guards.middleware";

const router = Router();

router.use(requireAuth);
router
  .route("/")
  .get(asyncHandler(listAlertChannels))
  .post(requireJsonContentType, asyncHandler(createAlertChannel))
  .all(methodNotAllowed(["GET", "POST"]));

export default router;
