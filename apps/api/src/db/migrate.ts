import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from './client';

export function runMigrations(): void {
  const schemaPath = resolve(import.meta.dir, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');
  db.exec(sql);

  // Safely alter existing tables if migrating from previous schema
  try {
    db.exec(`ALTER TABLE runs ADD COLUMN viewport TEXT DEFAULT 'desktop';`);
  } catch {}
  try {
    db.exec(`ALTER TABLE runs ADD COLUMN auto_approve INTEGER DEFAULT 0;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE runs ADD COLUMN test_plan_json TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE signals ADD COLUMN confidence REAL DEFAULT 1.0;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE findings ADD COLUMN annotated_screenshot_path TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE findings ADD COLUMN visual_bbox_json TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE steps ADD COLUMN actor TEXT DEFAULT 'agent';`);
  } catch {}
  try {
    db.exec(`ALTER TABLE steps ADD COLUMN scenario_id TEXT;`);
  } catch {}
  try {
    db.exec(`ALTER TABLE findings ADD COLUMN scenario_id TEXT;`);
  } catch {}
}

// Auto-run when executed directly
if (import.meta.main) {
  runMigrations();
  console.log('✅ SQLite migrations applied successfully.');
}
