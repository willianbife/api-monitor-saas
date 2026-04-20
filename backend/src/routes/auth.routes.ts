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
import {
  methodNotAllowed,
  requireJsonContentType,
} from "../middlewares/request-guards.middleware";

const router = Router();

router
  .route("/csrf")
  .get(asyncHandler(csrf))
  .all(methodNotAllowed(["GET"]));

router
  .route("/session")
  .get(asyncHandler(session))
  .all(methodNotAllowed(["GET"]));

router
  .route("/register")
  .post(requireJsonContentType, asyncHandler(register))
  .all(methodNotAllowed(["POST"]));

router
  .route("/login")
  .post(requireJsonContentType, asyncHandler(login))
  .all(methodNotAllowed(["POST"]));

router
  .route("/refresh")
  .post(asyncHandler(refresh))
  .all(methodNotAllowed(["POST"]));

router
  .route("/password-reset/request")
  .post(requireJsonContentType, asyncHandler(requestPasswordReset))
  .all(methodNotAllowed(["POST"]));

router
  .route("/password-reset/confirm")
  .post(requireJsonContentType, asyncHandler(resetPassword))
  .all(methodNotAllowed(["POST"]));

router
  .route("/email-verification/request")
  .post(requireAuth, asyncHandler(requestEmailVerification))
  .all(methodNotAllowed(["POST"]));

router
  .route("/email-verification/confirm")
  .post(requireJsonContentType, asyncHandler(verifyEmail))
  .all(methodNotAllowed(["POST"]));

router
  .route("/logout")
  .post(requireAuth, asyncHandler(logout))
  .all(methodNotAllowed(["POST"]));

router
  .route("/me")
  .get(requireAuth, asyncHandler(me))
  .all(methodNotAllowed(["GET"]));

export default router;
