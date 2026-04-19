import { Queue, Worker } from "bullmq";
import Redis from "ioredis";
import "dotenv/config";
import prisma from "../lib/prisma";
import { checkEndpoint } from "../services/monitor.service";

const redisConnection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

export const monitorQueue = new Queue("api-monitor", { connection: redisConnection });

export const monitorWorker = new Worker(
  "api-monitor",
  async (job) => {
    if (job.name === "check-endpoint") {
      await checkEndpoint(job.data.endpointId);
    }
  },
  { connection: redisConnection }
);

monitorWorker.on("completed", (job) => {
  console.log(`[Worker] Job completed for endpoint ${job.data.endpointId}`);
});

monitorWorker.on("failed", (job, err) => {
  console.error(`[Worker] Job failed for endpoint ${job?.data.endpointId}`, err);
});

// Function to synchronize database endpoints with the queue
export const syncQueueWithDatabase = async () => {
  const endpoints = await prisma.apiEndpoint.findMany();
  
  // Clear existing repeatable jobs to avoid duplicates
  const repeatableJobs = await monitorQueue.getRepeatableJobs();
  for (const job of repeatableJobs) {
    await monitorQueue.removeRepeatableByKey(job.key);
  }

  // Re-add all endpoints based on their interval
  for (const endpoint of endpoints) {
    await monitorQueue.add(
      "check-endpoint",
      { endpointId: endpoint.id },
      {
        repeat: {
          every: endpoint.interval * 1000,
        },
        jobId: `monitor_${endpoint.id}`,
      }
    );
  }
  console.log(`[Queue] Synced ${endpoints.length} endpoints for monitoring.`);
};
