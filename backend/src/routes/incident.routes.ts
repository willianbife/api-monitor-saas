import { Router } from "express";
import {
  addIncidentNote,
  createIncident,
  listIncidents,
} from "../controllers/incident.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(listIncidents));
router.post("/", asyncHandler(createIncident));
router.post("/:id/notes", asyncHandler(addIncidentNote));

export default router;
