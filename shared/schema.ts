import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users for admin access
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Video schema to store information about scraped videos
export const videos = pgTable("videos", {
  id: serial("id").primaryKey(),
  videoId: text("video_id").notNull().unique(),
  title: text("title").default(""),
  url: text("url").notNull(),
  quality: text("quality").default("HD"),
  qualityOptions: text("quality_options").array(), // Array of quality options as JSON strings
  scrapedAt: timestamp("scraped_at").defaultNow(),
  lastAccessed: timestamp("last_accessed").defaultNow(),
  accessCount: integer("access_count").default(0),
});

export const insertVideoSchema = createInsertSchema(videos).pick({
  videoId: true,
  title: true,
  url: true,
  quality: true,
});

// Domain whitelist schema
export const domains = pgTable("domains", {
  id: serial("id").primaryKey(),
  domain: text("domain").notNull().unique(),
  active: boolean("active").default(true),
  addedAt: timestamp("added_at").defaultNow(),
});

export const insertDomainSchema = createInsertSchema(domains).pick({
  domain: true,
  active: true,
});

// Log entries schema
export const logs = pgTable("logs", {
  id: serial("id").primaryKey(),
  timestamp: timestamp("timestamp").defaultNow(),
  level: text("level").notNull(),
  source: text("source").notNull(),
  message: text("message").notNull(),
});

export const insertLogSchema = createInsertSchema(logs).pick({
  level: true,
  source: true,
  message: true,
});

// Define types for use in the app
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertVideo = z.infer<typeof insertVideoSchema>;
export type Video = typeof videos.$inferSelect;

export type InsertDomain = z.infer<typeof insertDomainSchema>;
export type Domain = typeof domains.$inferSelect;

export type InsertLog = z.infer<typeof insertLogSchema>;
export type Log = typeof logs.$inferSelect;

// Ensure all schema types are properly defined
export interface VideoInterface {
  id: number;
  videoId: string;
  title: string | null;
  url: string;
  quality: string | null;
  scrapedAt: Date | null;
  lastAccessed: Date | null;
  accessCount: number | null;
}

// Settings schema for scraper configuration
export type ScraperSettings = {
  timeout: number;
  autoRetry: boolean;
  cacheEnabled: boolean;
  cacheTTL: number;
};
