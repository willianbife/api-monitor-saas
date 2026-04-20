import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import prisma from "../lib/prisma";
import { checkEndpoint } from "../services/monitor.service";
import { env } from "../config/env";

const redisConnection = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

export const monitorQueue = new Queue("api-monitor", { connection: redisConnection });

let queueAvailable = env.ENABLE_MONITOR_WORKER;
let queueDisabledReason: string | null = env.ENABLE_MONITOR_WORKER
  ? null
  : "Monitor worker disabled by configuration";
let workerStarted = false;

const isRedisQuotaError = (error: unknown) =>
  error instanceof Error && /max requests limit exceeded/i.test(error.message);

const handleQueueFailure = async (context: string, error: unknown) => {
  if (isRedisQuotaError(error)) {
    queueAvailable = false;
    queueDisabledReason = "Redis request quota exceeded";
  }

  console.error(`[Queue] ${context}`, error);
};

let monitorWorker: Worker | null = null;

if (env.ENABLE_MONITOR_WORKER) {
  monitorWorker = new Worker(
    "api-monitor",
    async (job) => {
      if (job.name === "check-endpoint") {
        await checkEndpoint(job.data.endpointId);
      }
    },
    {
      autorun: false,
      connection: redisConnection,
    }
  );

  monitorWorker.on("completed", (job) => {
    console.log(`[Worker] Job completed for endpoint ${job.data.endpointId}`);
  });

  monitorWorker.on("failed", (job, err) => {
    console.error(`[Worker] Job failed for endpoint ${job?.data.endpointId}`, err);
  });

  monitorWorker.on("error", (error) => {
    void handleQueueFailure("Worker error", error);
  });
}

redisConnection.on("error", (error) => {
  void handleQueueFailure("Redis connection error", error);
});

export const getMonitorQueueStatus = () => ({
  enabled: env.ENABLE_MONITOR_WORKER,
  available: queueAvailable,
  reason: queueDisabledReason,
});

export const scheduleEndpointMonitoring = async (endpointId: string, interval: number) => {
  if (!env.ENABLE_MONITOR_WORKER) {
    throw new Error("Monitoring worker is disabled");
  }

  if (!queueAvailable) {
    throw new Error(queueDisabledReason || "Monitoring queue is unavailable");
  }

  try {
    await monitorQueue.add(
      "check-endpoint",
      { endpointId },
      {
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 200,
        removeOnFail: 500,
        repeat: {
          every: interval * 1000,
        },
        jobId: `monitor_${endpointId}`,
      }
    );
  } catch (error) {
    await handleQueueFailure("Failed to schedule endpoint monitoring", error);
    throw error;
  }
};

export const removeEndpointMonitoring = async (endpointId: string, interval: number) => {
  if (!env.ENABLE_MONITOR_WORKER || !queueAvailable) {
    return;
  }

  try {
    await monitorQueue.removeRepeatable(
      "check-endpoint",
      {
        every: interval * 1000,
      },
      `monitor_${endpointId}`
    );
  } catch (error) {
    await handleQueueFailure("Failed to remove endpoint monitoring", error);
  }
};

export const syncQueueWithDatabase = async () => {
  if (!env.ENABLE_MONITOR_WORKER || !queueAvailable) {
    console.warn("[Queue] Monitor worker is disabled. Skipping queue sync.");
    return;
  }

  try {
    const endpoints = await prisma.apiEndpoint.findMany();

    const repeatableJobs = await monitorQueue.getRepeatableJobs();
    for (const job of repeatableJobs) {
      await monitorQueue.removeRepeatableByKey(job.key);
    }

    for (const endpoint of endpoints) {
      await scheduleEndpointMonitoring(endpoint.id, endpoint.interval);
    }

    console.log(`[Queue] Synced ${endpoints.length} endpoints for monitoring.`);
  } catch (error) {
    await handleQueueFailure("Failed to sync queue with database", error);
  }
};

export const startMonitorWorker = async () => {
  if (!monitorWorker || workerStarted || !env.ENABLE_MONITOR_WORKER || !queueAvailable) {
    return;
  }

  workerStarted = true;

  void monitorWorker.run().catch(async (error) => {
    workerStarted = false;
    await handleQueueFailure("Monitor worker crashed", error);
  });
};
