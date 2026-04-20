import "dotenv/config";
import { startMonitorWorker, syncQueueWithDatabase } from "./workers/monitor.worker";
import { logger } from "./utils/logger";

const bootWorker = async () => {
  await syncQueueWithDatabase();
  await startMonitorWorker();

  logger.info("Background worker started");
};

void bootWorker().catch((error) => {
  logger.error("Background worker failed to boot", {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
