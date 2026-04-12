import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "@shared/schema";
import path from "path";
import fs from "fs";

// On Render (and other cloud hosts), use /tmp for writable storage.
// Locally, use the project root.
function getDbPath() {
  // Render sets RENDER=true in the environment
  if (process.env.RENDER || process.env.DB_PATH) {
    const dir = process.env.DB_PATH || "/tmp";
    return path.join(dir, "data.db");
  }
  return path.join(process.cwd(), "data.db");
}

const dbPath = getDbPath();
console.log(`[db] Using database at: ${dbPath}`);

const sqlite = new Database(dbPath);
sqlite.pragma("journal_mode = WAL");

export const db = drizzle(sqlite, { schema });
