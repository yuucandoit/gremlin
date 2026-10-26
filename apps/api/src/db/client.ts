import { Database } from 'bun:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function getWorkspaceRoot(): string {
  let curr = import.meta.dir;
  while (curr !== '/' && dirname(curr) !== curr) {
    if (existsSync(join(curr, 'apps')) && existsSync(join(curr, 'packages'))) {
      return curr;
    }
    curr = dirname(curr);
  }
  return process.cwd();
}

const root = getWorkspaceRoot();
const DB_PATH = process.env.DATABASE_PATH
  ? resolve(process.cwd(), process.env.DATABASE_PATH)
  : join(root, 'data/gremlin.db');

const dir = dirname(DB_PATH);
if (!existsSync(dir)) {
  mkdirSync(dir, { recursive: true });
}

export const db = new Database(DB_PATH, { create: true });

// Optimize for performance and integrity
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');
db.exec('PRAGMA synchronous = NORMAL;');
