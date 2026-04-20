import { Router } from "express";
import {
  getBillingOverview,
  stripeWebhook,
  updateBilling,
} from "../controllers/billing.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.post("/stripe/webhook", asyncHandler(stripeWebhook));
router.use(requireAuth);
router.get("/", asyncHandler(getBillingOverview));
router.put("/", asyncHandler(updateBilling));

export default router;
