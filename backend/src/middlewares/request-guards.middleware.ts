import { NextFunction, Request, Response } from "express";

const jsonContentTypePattern = /^application\/json\b/i;

export const requireJsonContentType = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") {
    next();
    return;
  }

  const contentType = req.header("content-type");

  if (!contentType || !jsonContentTypePattern.test(contentType)) {
    res.status(415).json({ error: "Content-Type must be application/json" });
    return;
  }

  next();
};

export const methodNotAllowed =
  (methods: string[]) => (_req: Request, res: Response): void => {
    res.setHeader("Allow", methods.join(", "));
    res.status(405).json({ error: "Method not allowed" });
  };
