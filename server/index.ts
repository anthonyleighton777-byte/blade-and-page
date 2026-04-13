import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { db, isPg } from "./db";
import { sql } from "drizzle-orm";

// Auto-create tables on startup — works for both Postgres and SQLite
async function migrateDb() {
  try {
    if (isPg) {
      // Postgres: use SERIAL and TEXT (no AUTOINCREMENT)
      await db.execute(sql`CREATE TABLE IF NOT EXISTS books (
        id SERIAL PRIMARY KEY,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        genre TEXT NOT NULL,
        subgenres TEXT NOT NULL DEFAULT '[]',
        description TEXT NOT NULL,
        martial_arts_score INTEGER NOT NULL DEFAULT 0,
        magic_score INTEGER NOT NULL DEFAULT 0,
        character_score INTEGER NOT NULL DEFAULT 0,
        series_name TEXT,
        series_book INTEGER,
        cover_color TEXT NOT NULL DEFAULT '#1a1a2e',
        cover_accent TEXT NOT NULL DEFAULT '#e94560',
        publish_year INTEGER,
        tags TEXT NOT NULL DEFAULT '[]'
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS user_tokens (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      )`);
      await db.execute(sql`CREATE TABLE IF NOT EXISTS user_ratings (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        read INTEGER NOT NULL DEFAULT 1,
        notes TEXT
      )`);
    } else {
      // SQLite: synchronous, use AUTOINCREMENT
      db.run(sql`CREATE TABLE IF NOT EXISTS books (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        author TEXT NOT NULL,
        genre TEXT NOT NULL,
        subgenres TEXT NOT NULL DEFAULT '[]',
        description TEXT NOT NULL,
        martial_arts_score INTEGER NOT NULL DEFAULT 0,
        magic_score INTEGER NOT NULL DEFAULT 0,
        character_score INTEGER NOT NULL DEFAULT 0,
        series_name TEXT,
        series_book INTEGER,
        cover_color TEXT NOT NULL DEFAULT '#1a1a2e',
        cover_accent TEXT NOT NULL DEFAULT '#e94560',
        publish_year INTEGER,
        tags TEXT NOT NULL DEFAULT '[]'
      )`);
      db.run(sql`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )`);
      try { db.run(sql`ALTER TABLE users ADD COLUMN email TEXT`); } catch { /* already exists */ }
      db.run(sql`CREATE TABLE IF NOT EXISTS user_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT NOT NULL UNIQUE,
        created_at INTEGER NOT NULL
      )`);
      db.run(sql`CREATE TABLE IF NOT EXISTS user_ratings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        book_id INTEGER NOT NULL,
        rating INTEGER NOT NULL,
        read INTEGER NOT NULL DEFAULT 1,
        notes TEXT
      )`);
    }
    console.log("[db] Tables ready.");
  } catch (e) {
    console.error("[db] Migration error:", e);
  }
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;
  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      log(logLine);
    }
  });
  next();
});

(async () => {
  await migrateDb();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Internal Server Error:", err);
    if (res.headersSent) return next(err);
    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen({ port, host: "0.0.0.0", reusePort: true }, () => {
    log(`serving on port ${port}`);
  });
})();
