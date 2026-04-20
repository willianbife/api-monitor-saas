import { Router } from "express";
import {
  addIncidentNote,
  createIncident,
  listIncidents,
} from "../controllers/incident.controller";
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
  .get(asyncHandler(listIncidents))
  .post(requireJsonContentType, asyncHandler(createIncident))
  .all(methodNotAllowed(["GET", "POST"]));

router
  .route("/:id/notes")
  .post(requireJsonContentType, asyncHandler(addIncidentNote))
  .all(methodNotAllowed(["POST"]));

export default router;
