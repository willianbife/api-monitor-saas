import express from "express";
import http from "http";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import { env } from "./config/env";
import {
  allowedHeaders,
  allowedMethods,
  allowedOrigins,
  isAllowedOrigin,
} from "./config/security";
import { initSocket } from "./lib/socket";
import { csrfProtection } from "./middlewares/csrf.middleware";
import { errorHandler, notFoundHandler } from "./middlewares/error.middleware";
import authRoutes from "./routes/auth.routes";
import endpointRoutes from "./routes/endpoint.routes";
import workspaceRoutes from "./routes/workspace.routes";
import incidentRoutes from "./routes/incident.routes";
import alertRoutes from "./routes/alert.routes";
import statusPageRoutes from "./routes/status-page.routes";
import opsRoutes from "./routes/ops.routes";
import billingRoutes from "./routes/billing.routes";
import {
  getMonitorQueueStatus,
  startMonitorWorker,
  syncQueueWithDatabase,
} from "./workers/monitor.worker";
import { logger } from "./utils/logger";

const app = express();
const server = http.createServer(app);

initSocket(server);

const corsOptions: cors.CorsOptions = {
  origin(origin, callback) {
    if (!origin || isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Origin not allowed by CORS"));
  },
  credentials: true,
  methods: allowedMethods,
  allowedHeaders,
};

app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        baseUri: ["'self'"],
        connectSrc: ["'self'", ...allowedOrigins],
        frameAncestors: ["'none'"],
        imgSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 63072000,
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: {
      policy: "strict-origin-when-cross-origin",
    },
  })
);
app.use(cors(corsOptions));
app.options("/{*splat}", cors(corsOptions));
app.use(express.json({ limit: "32kb" }));
app.use(express.urlencoded({ extended: false, limit: "32kb" }));
app.use(morgan("dev"));

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests" },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  skipSuccessfulRequests: true,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many authentication attempts" },
});

const writeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many write requests" },
});

const recoveryLimiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 10,
  skipSuccessfulRequests: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many recovery requests" },
});

const webhookLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many webhook requests" },
});

app.use("/api", apiLimiter);
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/auth/password-reset", recoveryLimiter);
app.use("/api/auth/refresh", authLimiter);
app.use("/api/workspaces/invite", writeLimiter);
app.use("/api/billing/stripe/webhook", webhookLimiter);
app.use("/api", csrfProtection);
app.use("/api/endpoints", writeLimiter);
app.use("/api/auth", authRoutes);
app.use("/api/endpoints", endpointRoutes);
app.use("/api/workspaces", workspaceRoutes);
app.use("/api/incidents", incidentRoutes);
app.use("/api/alerts", alertRoutes);
app.use("/api/status-pages", statusPageRoutes);
app.use("/api/billing", billingRoutes);
app.use("/ops", opsRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use(notFoundHandler);
app.use(errorHandler);

server.listen(env.PORT, async () => {
  logger.info("API server started", { port: env.PORT });
  await syncQueueWithDatabase();

  if (env.EMBEDDED_WORKER) {
    await startMonitorWorker();
  }

  const queueStatus = getMonitorQueueStatus();
  if (!queueStatus.enabled || !queueStatus.available) {
    logger.warn("Monitoring background worker unavailable", {
      reason: queueStatus.reason ?? "Unknown reason",
    });
  }
});
