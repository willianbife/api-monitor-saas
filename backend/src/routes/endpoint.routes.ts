import { Router } from "express";
import { createEndpoint, deleteEndpoint, listEndpoints } from "../controllers/endpoint.controller";
import { requireAuth } from "../middlewares/auth.middleware";

const router = Router();

router.use(requireAuth);
router.get("/", listEndpoints);
router.post("/", createEndpoint);
router.delete("/:id", deleteEndpoint);

export default router;
