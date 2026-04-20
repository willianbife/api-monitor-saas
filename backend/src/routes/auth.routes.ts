import { Router } from "express";
import { csrf, login, logout, me, register, session } from "../controllers/auth.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.get("/csrf", asyncHandler(csrf));
router.get("/session", asyncHandler(session));
router.post("/register", asyncHandler(register));
router.post("/login", asyncHandler(login));
router.post("/logout", requireAuth, asyncHandler(logout));
router.get("/me", requireAuth, asyncHandler(me));

export default router;
