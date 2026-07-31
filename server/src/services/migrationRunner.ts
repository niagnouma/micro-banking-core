import fs from "fs/promises";
import path from "path";
import Database from "bun:sqlite";
import logger from "../config/logger";

const resolveDbPath = (): string => {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && databaseUrl.startsWith("file:")) {
    let filePath = databaseUrl.slice("file:".length);
    if (filePath.startsWith("//")) {
      filePath = filePath.slice(2);
    }
    if (!path.isAbsolute(filePath)) {
      return path.resolve(process.cwd(), "prisma", filePath);
    }
    return filePath;
  }

  const databaseFile = process.env.DATABASE_FILE;
  if (databaseFile) {
    return databaseFile;
  }

  throw new Error("DATABASE_URL or DATABASE_FILE must be set for migrations.");
};

const ensureMigrationsTable = (db: Database) => {
  db.run(`
    CREATE TABLE IF NOT EXISTS _client_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      migration_name TEXT UNIQUE NOT NULL,
      applied_at TEXT NOT NULL
    );
  `);
};

const getMigrationFolders = async (
  migrationsPath: string,
): Promise<string[]> => {
  const entries = await fs.readdir(migrationsPath, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => entry.name)
    .sort();
};

const hasMigration = (db: Database, name: string): boolean => {
  const row = db
    .query(
      "SELECT 1 as present FROM _client_migrations WHERE migration_name = ? LIMIT 1",
    )
    .get(name);
  return !!row;
};

const applyMigration = async (db: Database, name: string, sqlPath: string) => {
  const sql = await fs.readFile(sqlPath, "utf8");
  if (!sql.trim()) {
    logger.warn(`Skipping empty migration: ${name}`);
    return;
  }

  logger.info(`[Migration] Applying: ${name}`);
  db.run("BEGIN");
  try {
    db.run(sql);
    db.query(
      "INSERT INTO _client_migrations (migration_name, applied_at) VALUES (?, datetime('now'))",
    ).run(name);
    db.run("COMMIT");
    logger.info(`[Migration] Applied: ${name}`);
  } catch (error) {
    db.run("ROLLBACK");
    throw error;
  }
};

export const runMigrationsIfNeeded = async (): Promise<void> => {
  const configuredMigrationsPath = process.env.PRISMA_MIGRATIONS_PATH;
  const migrationsPath =
    configuredMigrationsPath ||
    path.resolve(process.cwd(), "prisma", "migrations");

  try {
    await fs.access(migrationsPath);
  } catch (error) {
    if (
      !configuredMigrationsPath &&
      (error as NodeJS.ErrnoException).code === "ENOENT"
    ) {
      logger.warn(
        `Default migrations directory not found. Skipping migrations: ${migrationsPath}`,
      );
      return;
    }

    throw error;
  }

  const dbPath = resolveDbPath();
  const db = new Database(dbPath);
  db.run("PRAGMA journal_mode = WAL;");

  try {
    ensureMigrationsTable(db);

    const folders = await getMigrationFolders(migrationsPath);
    for (const folder of folders) {
      if (hasMigration(db, folder)) {
        continue;
      }

      const sqlPath = path.join(migrationsPath, folder, "migration.sql");
      try {
        await fs.access(sqlPath);
      } catch {
        logger.warn(`Missing migration.sql for ${folder}. Skipping.`);
        continue;
      }

      await applyMigration(db, folder, sqlPath);
    }
  } finally {
    db.close();
  }
};
