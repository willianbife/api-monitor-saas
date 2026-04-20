import { Router } from "express";
import {
  createWorkspace,
  inviteWorkspaceMember,
  listWorkspaces,
} from "../controllers/workspace.controller";
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
  .get(asyncHandler(listWorkspaces))
  .post(requireJsonContentType, asyncHandler(createWorkspace))
  .all(methodNotAllowed(["GET", "POST"]));

router
  .route("/invite")
  .post(requireJsonContentType, asyncHandler(inviteWorkspaceMember))
  .all(methodNotAllowed(["POST"]));

export default router;
