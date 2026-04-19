import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import "dotenv/config";

import { initSocket } from "./lib/socket";
import authRoutes from "./routes/auth.routes";
import endpointRoutes from "./routes/endpoint.routes";
import { syncQueueWithDatabase } from "./workers/monitor.worker";

const app = express();
const server = http.createServer(app);

initSocket(server);

app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);
app.use(express.json());
app.use(morgan("dev"));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
});

app.use("/api/", apiLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/endpoints", endpointRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

const PORT = Number(process.env.PORT || 4000);

server.listen(PORT, async () => {
  console.log(`Server running on http://localhost:${PORT}`);
  await syncQueueWithDatabase();
});
