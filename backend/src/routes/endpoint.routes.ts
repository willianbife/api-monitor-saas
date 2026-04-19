import { Router } from "express";
import {
  createEndpoint,
  deleteEndpoint,
  listEndpoints,
} from "../controllers/endpoint.controller";
import { asyncHandler } from "../middlewares/async.middleware";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/", asyncHandler(listEndpoints));
router.post("/", asyncHandler(createEndpoint));
router.delete("/:id", asyncHandler(deleteEndpoint));

export default router;
