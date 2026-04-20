import { Router } from "express";
import {
  getStatusPage,
  updateStatusPage,
} from "../controllers/status-page.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  methodNotAllowed,
  requireJsonContentType,
} from "../middlewares/request-guards.middleware";

const router = Router();

router
  .route("/public/:slug")
  .get(asyncHandler(getStatusPage))
  .all(methodNotAllowed(["GET"]));

router
  .route("/")
  .put(requireAuth, requireJsonContentType, asyncHandler(updateStatusPage))
  .all(methodNotAllowed(["PUT"]));

export default router;
