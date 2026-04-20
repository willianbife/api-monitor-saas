import { Router } from "express";
import {
  getBillingOverview,
  stripeWebhook,
  updateBilling,
} from "../controllers/billing.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";
import {
  methodNotAllowed,
  requireJsonContentType,
} from "../middlewares/request-guards.middleware";

const router = Router();

router
  .route("/stripe/webhook")
  .post(requireJsonContentType, asyncHandler(stripeWebhook))
  .all(methodNotAllowed(["POST"]));

router.use(requireAuth);
router
  .route("/")
  .get(asyncHandler(getBillingOverview))
  .put(requireJsonContentType, asyncHandler(updateBilling))
  .all(methodNotAllowed(["GET", "PUT"]));

export default router;
