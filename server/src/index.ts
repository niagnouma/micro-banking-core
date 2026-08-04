import dotenv from "dotenv";
import path from "node:path";

import app from "./app";
import { databaseService } from "./services/database";
import logger from "./config/logger";
import { startExpirationService, stopExpirationService } from "./services/cron";

const tauriEnvPath = process.env.TAURI_ENV_PATH;
const defaultEnvPath = path.resolve(__dirname, "..", ".env");
if (tauriEnvPath) {
  dotenv.config({ path: tauriEnvPath });
} else {
  dotenv.config({ path: defaultEnvPath });
}

const normalizePath = (p: string | undefined): string | undefined => {
  if (!p) return p;
  // Remove Windows UNC long path prefix if present (\\?\)
  let normalized = p;
  if (normalized.startsWith("\\\\?\\")) {
    normalized = normalized.slice(4);
  }
  return normalized;
};

// Normalize important Prisma paths at the entry point to improve Windows compatibility
const prismaEnvVarsToNormalize = [
  "PRISMA_SCHEMA_PATH",
  "PRISMA_MIGRATIONS_PATH",
  "PRISMA_QUERY_ENGINE_WASM_PATH",
  "PRISMA_QUERY_ENGINE_LIBRARY",
  "PRISMA_QUERY_ENGINE_BINARY",
];

for (const envVar of prismaEnvVarsToNormalize) {
  if (process.env[envVar]) {
    process.env[envVar] = normalizePath(process.env[envVar]);
  }
}

const port = Number(process.env.PORT) || 3000;
let server: ReturnType<typeof app.listen> | null = null;
let shuttingDown = false;

logger.info("Starting server bootstrap", {
  port,
  cwd: process.cwd(),
  env: {
    LOG_DIR: process.env.LOG_DIR,
    TAURI_ENV_PATH: process.env.TAURI_ENV_PATH,
    DATABASE_FILE: process.env.DATABASE_FILE,
    PRISMA_SCHEMA_PATH: process.env.PRISMA_SCHEMA_PATH,
    PRISMA_MIGRATIONS_PATH: process.env.PRISMA_MIGRATIONS_PATH,
    PRISMA_QUERY_ENGINE_WASM_PATH: process.env.PRISMA_QUERY_ENGINE_WASM_PATH,
    PRISMA_QUERY_ENGINE_LIBRARY: process.env.PRISMA_QUERY_ENGINE_LIBRARY,
  },
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception", { error });
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled rejection", { reason });
});

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info(`Received ${signal}. Shutting down...`);
  stopExpirationService();

  const closeServer = new Promise<void>((resolve) => {
    if (!server) return resolve();
    server.close(() => resolve());
  });

  const timeout = setTimeout(() => {
    logger.error("Force exiting after timeout.");
    process.exit(1);
  }, 10_000);

  try {
    await Promise.allSettled([
      closeServer,
      databaseService.closeDbConnection(),
    ]);
    clearTimeout(timeout);
    logger.info("Shutdown complete.");
    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    logger.error("Shutdown failed:", { error });
    process.exit(1);
  }
};

app.set("shutdown", shutdown);

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

// Initialize the database and then start the server
databaseService
  .initializeDatabase()
  .then(() => {
    // Start background services
    startExpirationService();

    server = app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });
    server.on("error", (error: any) => {
      logger.error("Server failed to start", { error });
      process.exit(1);
    });
  })
  .catch((error: any) => {
    // Improved error logging for production diagnostics
    const errorDetails =
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
            code: (error as any).code,
          }
        : error;
    logger.error("Failed to initialize server:", { error: errorDetails });
    process.exit(1);
  });
