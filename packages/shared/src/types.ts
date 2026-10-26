export type RunStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type SignalType =
  | 'console_error'
  | 'console_warn'
  | 'network_error'
  | 'dead_click'
  | 'stuck_loop'
  | 'unhandled_rejection'
  | 'http_5xx'
  | 'visual_defect';

export type FindingCategory = 'crash' | 'functional' | 'network' | 'ux' | 'accessibility' | 'visual';

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

export interface TestPlan {
  overview: string;
  authDetected: boolean;
  phases: string[];
  riskAreas: string[];
}

export interface VisualBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
}

export interface Run {
  id: string;
  url: string;
  personaId: string;
  viewport?: 'desktop' | 'mobile';
  status: RunStatus;
  maxSteps: number;
  timeoutMs: number;
  currentStep: number;
  totalSignals: number;
  testPlan?: TestPlan | null;
  error?: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
}

export interface Step {
  id: string;
  runId: string;
  stepNumber: number;
  actor?: 'agent' | 'human';
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
  confidence?: number;
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
  annotatedScreenshotPath?: string | null;
  visualBoundingBox?: VisualBoundingBox | null;
  evidence?: Record<string, any>;
  timestamp: string;
}

export interface RunReport {
  run: Run;
  persona?: Persona;
  testPlan?: TestPlan | null;
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
    visualCount: number;
  };
}

export interface CreateRunRequest {
  url: string;
  personaId?: string;
  viewport?: 'desktop' | 'mobile';
  maxSteps?: number;
  timeoutMs?: number;
  chaosMode?: boolean;
}

export interface InteractiveInputRequest {
  type: 'click' | 'double_click' | 'type' | 'press_key' | 'scroll';
  x?: number; // Normalized (0.0 to 1.0)
  y?: number;
  selector?: string;
  text?: string;
  key?: string;
  deltaX?: number;
  deltaY?: number;
}

export interface InspectElementResult {
  selector: string;
  tagName: string;
  text: string;
  role?: string;
  box: VisualBoundingBox;
}

export interface ManualGuidanceRequest {
  instruction: string;
  targetSelector?: string;
}
