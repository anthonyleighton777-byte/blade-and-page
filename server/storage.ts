import { db, isPg } from "./db";
import {
  books, users, userRatings, userTokens,
  type Book, type InsertBook,
  type User, type InsertUser,
  type UserRating, type InsertRating,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { randomBytes } from "crypto";

// Helper: Drizzle returns arrays from .returning() on Postgres,
// but .returning().get() only works on SQLite. This normalises both.
async function first<T>(q: Promise<T[]>): Promise<T> {
  const rows = await q;
  return (rows as any[])[0] as T;
}

export interface IStorage {
  getAllBooks(): Promise<Book[]>;
  getBook(id: number): Promise<Book | undefined>;
  addBook(data: InsertBook): Promise<Book>;
  seedBooks(data: InsertBook[]): Promise<void>;
  getBooksCount(): Promise<number>;

  findOrCreateUserByEmail(email: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserById(id: number): Promise<User | undefined>;

  createToken(userId: number): Promise<string>;
  getUserByToken(token: string): Promise<User | undefined>;

  getUserRatings(userId: number): Promise<UserRating[]>;
  getUserRating(userId: number, bookId: number): Promise<UserRating | undefined>;
  getAllRatings(): Promise<UserRating[]>;
  upsertRating(data: InsertRating): Promise<UserRating>;
  deleteRating(userId: number, bookId: number): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // ── Books ──────────────────────────────────────────────────────────────────
  async getAllBooks(): Promise<Book[]> {
    return db.select().from(books);
  }

  async getBook(id: number): Promise<Book | undefined> {
    const rows = await db.select().from(books).where(eq(books.id, id));
    return rows[0];
  }

  async addBook(data: InsertBook): Promise<Book> {
    return first(db.insert(books).values(data).returning());
  }

  async seedBooks(data: InsertBook[]): Promise<void> {
    await db.insert(books).values(data);
  }

  async getBooksCount(): Promise<number> {
    const rows = await db.select().from(books);
    return rows.length;
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  async findOrCreateUserByEmail(email: string): Promise<User> {
    const rows = await db.select().from(users).where(eq(users.email, email));
    if (rows[0]) return rows[0];
    const username = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 24) || "reader";
    return first(db.insert(users).values({ email, username, createdAt: Date.now() }).returning());
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.email, email));
    return rows[0];
  }

  async getUserById(id: number): Promise<User | undefined> {
    const rows = await db.select().from(users).where(eq(users.id, id));
    return rows[0];
  }

  // ── Persistent Tokens ──────────────────────────────────────────────────────
  async createToken(userId: number): Promise<string> {
    const token = randomBytes(32).toString("hex");
    await db.insert(userTokens).values({ userId, token, createdAt: Date.now() });
    return token;
  }

  async getUserByToken(token: string): Promise<User | undefined> {
    const rows = await db.select().from(userTokens).where(eq(userTokens.token, token));
    if (!rows[0]) return undefined;
    const userRows = await db.select().from(users).where(eq(users.id, rows[0].userId));
    return userRows[0];
  }

  // ── Ratings ────────────────────────────────────────────────────────────────
  async getUserRatings(userId: number): Promise<UserRating[]> {
    return db.select().from(userRatings).where(eq(userRatings.userId, userId));
  }

  async getUserRating(userId: number, bookId: number): Promise<UserRating | undefined> {
    const rows = await db.select().from(userRatings)
      .where(and(eq(userRatings.userId, userId), eq(userRatings.bookId, bookId)));
    return rows[0];
  }

  async getAllRatings(): Promise<UserRating[]> {
    return db.select().from(userRatings);
  }

  async upsertRating(data: InsertRating): Promise<UserRating> {
    const existing = await this.getUserRating(data.userId, data.bookId);
    if (existing) {
      return first(
        db.update(userRatings)
          .set({ rating: data.rating, notes: data.notes })
          .where(and(eq(userRatings.userId, data.userId), eq(userRatings.bookId, data.bookId)))
          .returning()
      );
    }
    return first(db.insert(userRatings).values(data).returning());
  }

  async deleteRating(userId: number, bookId: number): Promise<void> {
    await db.delete(userRatings)
      .where(and(eq(userRatings.userId, userId), eq(userRatings.bookId, bookId)));
  }
}

export const storage = new DatabaseStorage();
