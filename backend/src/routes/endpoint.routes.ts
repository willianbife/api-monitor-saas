import { Router } from "express";
import {
  createEndpoint,
  deleteEndpoint,
  listEndpoints,
} from "../controllers/endpoint.controller";
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
  .get(asyncHandler(listEndpoints))
  .post(requireJsonContentType, asyncHandler(createEndpoint))
  .all(methodNotAllowed(["GET", "POST"]));

router
  .route("/:id")
  .delete(asyncHandler(deleteEndpoint))
  .all(methodNotAllowed(["DELETE"]));

export default router;
