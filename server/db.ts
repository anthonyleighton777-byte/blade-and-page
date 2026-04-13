import * as schema from "@shared/schema";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import Database from "better-sqlite3";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import path from "path";

function getDb() {
  if (process.env.DATABASE_URL) {
    const sql = neon(process.env.DATABASE_URL);
    const db = drizzleNeon(sql, { schema });
    console.log("[db] Using Neon Postgres (persistent)");
    return { db, isPg: true };
  } else {
    const dbPath = path.join(process.cwd(), "data.db");
    const sqlite = new Database(dbPath);
    sqlite.pragma("journal_mode = WAL");
    const db = drizzleSqlite(sqlite, { schema });
    console.log(`[db] Using SQLite at: ${dbPath}`);
    return { db, isPg: false };
  }
}

const { db, isPg } = getDb();
export { db, isPg };
