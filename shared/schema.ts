import { pgTable, text, integer, serial } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const books = pgTable("books", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  genre: text("genre").notNull(),
  subgenres: text("subgenres").notNull().default("[]"), // JSON array
  description: text("description").notNull(),
  martialArtsScore: integer("martial_arts_score").notNull().default(0),
  magicScore: integer("magic_score").notNull().default(0),
  characterScore: integer("character_score").notNull().default(0),
  seriesName: text("series_name"),
  seriesBook: integer("series_book"),
  coverColor: text("cover_color").notNull().default("#1a1a2e"),
  coverAccent: text("cover_accent").notNull().default("#e94560"),
  publishYear: integer("publish_year"),
  tags: text("tags").notNull().default("[]"), // JSON array
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const userTokens = pgTable("user_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const userRatings = pgTable("user_ratings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  bookId: integer("book_id").notNull(),
  rating: integer("rating").notNull(),
  read: integer("read").notNull().default(1),
  notes: text("notes"),
});

export const insertBookSchema = createInsertSchema(books).omit({ id: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true });
export const insertRatingSchema = createInsertSchema(userRatings).omit({ id: true });
export const insertTokenSchema = createInsertSchema(userTokens).omit({ id: true });

export type Book = typeof books.$inferSelect;
export type InsertBook = z.infer<typeof insertBookSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserRating = typeof userRatings.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type UserToken = typeof userTokens.$inferSelect;
