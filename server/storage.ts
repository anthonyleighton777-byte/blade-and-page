import { db } from "./db";
import {
  books, users, userRatings,
  type Book, type InsertBook,
  type User, type InsertUser,
  type UserRating, type InsertRating,
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // Books
  getAllBooks(): Book[];
  getBook(id: number): Book | undefined;
  addBook(data: InsertBook): Book;
  seedBooks(data: InsertBook[]): void;
  getBooksCount(): number;

  // Users
  createUser(data: InsertUser): User;
  getUserByUsername(username: string): User | undefined;
  getUserById(id: number): User | undefined;

  // Ratings (per-user)
  getUserRatings(userId: number): UserRating[];
  getUserRating(userId: number, bookId: number): UserRating | undefined;
  getAllRatings(): UserRating[];
  upsertRating(data: InsertRating): UserRating;
  deleteRating(userId: number, bookId: number): void;
}

export class DatabaseStorage implements IStorage {
  // ── Books ──────────────────────────────────────────────────────────────────
  getAllBooks(): Book[] {
    return db.select().from(books).all();
  }

  getBook(id: number): Book | undefined {
    return db.select().from(books).where(eq(books.id, id)).get();
  }

  addBook(data: InsertBook): Book {
    return db.insert(books).values(data).returning().get();
  }

  seedBooks(data: InsertBook[]): void {
    db.insert(books).values(data).run();
  }

  getBooksCount(): number {
    return db.select().from(books).all().length;
  }

  // ── Users ──────────────────────────────────────────────────────────────────
  createUser(data: InsertUser): User {
    return db.insert(users).values(data).returning().get();
  }

  getUserByUsername(username: string): User | undefined {
    return db.select().from(users).where(eq(users.username, username)).get();
  }

  getUserById(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  // ── Ratings ────────────────────────────────────────────────────────────────
  getUserRatings(userId: number): UserRating[] {
    return db.select().from(userRatings).where(eq(userRatings.userId, userId)).all();
  }

  getUserRating(userId: number, bookId: number): UserRating | undefined {
    return db.select().from(userRatings)
      .where(and(eq(userRatings.userId, userId), eq(userRatings.bookId, bookId)))
      .get();
  }

  getAllRatings(): UserRating[] {
    return db.select().from(userRatings).all();
  }

  upsertRating(data: InsertRating): UserRating {
    const existing = this.getUserRating(data.userId, data.bookId);
    if (existing) {
      return db.update(userRatings)
        .set({ rating: data.rating, notes: data.notes })
        .where(and(eq(userRatings.userId, data.userId), eq(userRatings.bookId, data.bookId)))
        .returning().get();
    }
    return db.insert(userRatings).values(data).returning().get();
  }

  deleteRating(userId: number, bookId: number): void {
    db.delete(userRatings)
      .where(and(eq(userRatings.userId, userId), eq(userRatings.bookId, bookId)))
      .run();
  }
}

export const storage = new DatabaseStorage();
