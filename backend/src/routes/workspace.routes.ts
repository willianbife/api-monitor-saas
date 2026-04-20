import { Router } from "express";
import {
  createWorkspace,
  inviteWorkspaceMember,
  listWorkspaces,
} from "../controllers/workspace.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(listWorkspaces));
router.post("/", asyncHandler(createWorkspace));
router.post("/invite", asyncHandler(inviteWorkspaceMember));

export default router;
