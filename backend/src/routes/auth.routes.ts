import { Router } from "express";
import {
  csrf,
  login,
  logout,
  me,
  refresh,
  register,
  requestEmailVerification,
  requestPasswordReset,
  resetPassword,
  session,
  verifyEmail,
} from "../controllers/auth.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/csrf", asyncHandler(csrf));
router.get("/session", asyncHandler(session));
router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/refresh", asyncHandler(refresh));
router.post("/password-reset/request", asyncHandler(requestPasswordReset));
router.post("/password-reset/confirm", asyncHandler(resetPassword));
router.post("/email-verification/request", requireAuth, asyncHandler(requestEmailVerification));
router.post("/email-verification/confirm", asyncHandler(verifyEmail));
router.post("/logout", requireAuth, asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
