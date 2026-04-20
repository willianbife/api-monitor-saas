import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { HttpError } from "../utils/http-errors";
import { env } from "../config/env";

export const notFoundHandler = (_req: Request, res: Response) => {
  res.status(404).json({ error: "Resource not found" });
};

export const errorHandler = (
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (error instanceof ZodError) {
    res.status(400).json({
      error: "Validation failed",
      ...(env.NODE_ENV !== "production" ? { details: error.flatten() } : {}),
    });
    return;
  }

  if (error instanceof HttpError) {
    res.status(error.statusCode).json({
      error: error.message,
      ...(env.NODE_ENV !== "production" && error.details ? { details: error.details } : {}),
    });
    return;
  }

  console.error("[INTERNAL ERROR]", {
    method: req.method,
    path: req.originalUrl,
    error,
  });

  res.status(500).json({ error: "Internal server error" });
};
