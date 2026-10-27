-- Gremlin SQLite Schema
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  persona_id TEXT NOT NULL DEFAULT 'gremlin',
  viewport TEXT NOT NULL DEFAULT 'desktop',
  status TEXT NOT NULL DEFAULT 'queued',
  auto_approve INTEGER NOT NULL DEFAULT 0,
  max_steps INTEGER NOT NULL DEFAULT 20,
  timeout_ms INTEGER NOT NULL DEFAULT 60000,
  current_step INTEGER NOT NULL DEFAULT 0,
  total_signals INTEGER NOT NULL DEFAULT 0,
  test_plan_json TEXT,
  error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_runs_created_at ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);

CREATE TABLE IF NOT EXISTS steps (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  scenario_id TEXT,
  step_number INTEGER NOT NULL,
  actor TEXT NOT NULL DEFAULT 'agent',
  action_json TEXT NOT NULL,
  thought TEXT NOT NULL,
  screenshot_path TEXT,
  aria_snapshot TEXT,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_steps_run_id ON steps(run_id);
CREATE INDEX IF NOT EXISTS idx_steps_run_step ON steps(run_id, step_number);

CREATE TABLE IF NOT EXISTS signals (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  step_number INTEGER,
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  confidence REAL DEFAULT 1.0,
  data_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_signals_run_id ON signals(run_id);
CREATE INDEX IF NOT EXISTS idx_signals_type ON signals(type);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  scenario_id TEXT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  category TEXT NOT NULL,
  reproduction_steps_json TEXT NOT NULL,
  suggested_fix TEXT NOT NULL,
  first_detected_step INTEGER NOT NULL DEFAULT 1,
  annotated_screenshot_path TEXT,
  visual_bbox_json TEXT,
  evidence_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE,
  FOREIGN KEY (scenario_id) REFERENCES scenarios(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_findings_run_id ON findings(run_id);
CREATE INDEX IF NOT EXISTS idx_findings_severity ON findings(severity);

CREATE TABLE IF NOT EXISTS scenarios (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  idx INTEGER NOT NULL DEFAULT 0,
  title TEXT NOT NULL,
  goal TEXT NOT NULL,
  persona_id TEXT DEFAULT 'gremlin',
  viewport TEXT DEFAULT 'desktop',
  needs_auth INTEGER NOT NULL DEFAULT 0,
  risk TEXT NOT NULL DEFAULT 'low',
  max_steps INTEGER NOT NULL DEFAULT 8,
  expect_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'ai',
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending',
  verdict TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_scenarios_run ON scenarios(run_id, idx ASC);
CREATE INDEX IF NOT EXISTS idx_scenarios_status ON scenarios(status);

CREATE TABLE IF NOT EXISTS run_events (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (run_id) REFERENCES runs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_run_events_run_id ON run_events(run_id);
