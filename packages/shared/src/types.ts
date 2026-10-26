export type RunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type SignalType =
  | 'console_error'
  | 'console_warn'
  | 'network_error'
  | 'dead_click'
  | 'stuck_loop'
  | 'unhandled_rejection'
  | 'http_5xx';

export type FindingCategory = 'crash' | 'functional' | 'network' | 'ux' | 'accessibility';

export interface Persona {
  id: string;
  name: string;
  tagline: string;
  description: string;
  systemPrompt: string;
  chaosLevel: number; // 0 to 1
  preferredActions: string[];
  avatar?: string;
}

export interface Run {
  id: string;
  url: string;
  personaId: string;
  status: RunStatus;
  maxSteps: number;
  timeoutMs: number;
  currentStep: number;
  totalSignals: number;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface Step {
  id: string;
  runId: string;
  stepNumber: number;
  action: import('./actions').AgentAction;
  thought: string;
  screenshotPath?: string | null;
  ariaSnapshot?: string | null;
  durationMs: number;
  timestamp: string;
  signals?: Signal[];
}

export interface Signal {
  id: string;
  runId: string;
  stepNumber?: number | null;
  type: SignalType;
  message: string;
  data?: Record<string, any>;
  timestamp: string;
}

export interface Finding {
  id: string;
  runId: string;
  title: string;
  description: string;
  severity: Severity;
  category: FindingCategory;
  reproductionSteps: string[];
  suggestedFix: string;
  firstDetectedStep: number;
  evidence?: Record<string, any>;
  timestamp: string;
}

export interface RunReport {
  run: Run;
  persona?: Persona;
  steps: Step[];
  signals: Signal[];
  findings: Finding[];
  regressionSpec: string;
  stats: {
    durationMs: number;
    totalSteps: number;
    totalSignals: number;
    totalFindings: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
  };
}

export interface CreateRunRequest {
  url: string;
  personaId?: string;
  maxSteps?: number;
  timeoutMs?: number;
  chaosMode?: boolean;
}
