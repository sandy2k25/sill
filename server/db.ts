// This file is kept for compatibility purposes but database is not used
// We use Telegram storage instead of PostgreSQL
import * as schema from "@shared/schema";

// Create stub objects that don't do anything
export const pool = {
  connect: () => Promise.resolve({}),
  end: () => Promise.resolve()
};

// Create a stub db object that returns empty data
export const db = {
  select: () => ({ from: () => ({ where: () => Promise.resolve([]) }) }),
  insert: () => ({ values: () => ({ returning: () => Promise.resolve([]) }) }),
  update: () => ({ set: () => ({ where: () => ({ returning: () => Promise.resolve([]) }) }) }),
  delete: () => ({ where: () => Promise.resolve([]) })
};