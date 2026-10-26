import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { db } from './client';

export function runMigrations(): void {
  const schemaPath = resolve(import.meta.dir, 'schema.sql');
  const sql = readFileSync(schemaPath, 'utf-8');
  db.exec(sql);
}

// Auto-run when executed directly
if (import.meta.main) {
  runMigrations();
  console.log('✅ SQLite migrations applied successfully.');
}
