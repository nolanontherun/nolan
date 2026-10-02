import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";

const globalForDb = globalThis as unknown as { __nolanDb?: Database.Database };

export function dbPath() {
  return process.env.NOLAN_DB || path.join(process.cwd(), "data", "nolan-os.db");
}

export function getDb(): Database.Database {
  if (globalForDb.__nolanDb) return globalForDb.__nolanDb;
  const file = dbPath();
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  globalForDb.__nolanDb = db;
  return db;
}

export function all<T = any>(sql: string, ...params: any[]): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}
export function get<T = any>(sql: string, ...params: any[]): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}
export function run(sql: string, ...params: any[]) {
  return getDb().prepare(sql).run(...params);
}
export function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 8)}${Date.now().toString(36).slice(-4)}`;
}
export function log(entity: string, entityId: string, kind: string, summary: string, detail?: string) {
  run("INSERT INTO activity_log (id, entity, entity_id, at, kind, summary, detail) VALUES (?,?,?,?,?,?,?)", uid("ac"), entity, entityId, new Date().toISOString(), kind, summary, detail ?? null);
}

export function getSetting<T = any>(key: string, fallback: T): T {
  const row = get<{ value: string }>("SELECT value FROM settings WHERE key = ?", key);
  if (!row) return fallback;
  try { return JSON.parse(row.value) as T; } catch { return fallback; }
}
export function setSetting(key: string, value: unknown) {
  run("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", key, JSON.stringify(value));
}
