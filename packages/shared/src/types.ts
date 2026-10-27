export type RunStatus = 'queued' | 'planning' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

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

export type ScenarioStatus = 'pending' | 'running' | 'passed' | 'failed' | 'inconclusive' | 'blocked' | 'skipped';
export type ScenarioSource = 'ai' | 'user' | 'template' | 'recorded';
export type ScenarioRisk = 'low' | 'medium' | 'high';
export type AuthMode = 'none' | 'requires' | 'tests_login';

export interface VerdictCheck {
  criterion: string;
  result: 'met' | 'violated' | 'unknown';
  evidence?: string;
}

export interface Scenario {
  id: string;
  runId: string;
  idx: number;
  title: string;
  goal: string;
  personaId?: string;
  viewport?: 'desktop' | 'mobile';
  needsAuth: boolean;
  authMode: AuthMode;
  risk: ScenarioRisk;
  maxSteps: number;
  expect: string[];
  source: ScenarioSource;
  enabled: boolean;
  status: ScenarioStatus;
  verdict?: string | null;
  checks?: VerdictCheck[];
  createdAt: string;
}

export interface ScenarioCoverage {
  total: number;
  enabled: number;
  passed: number;
  failed: number;
  inconclusive: number;
  blocked: number;
  skipped: number;
  pending: number;
  percentage: number;
}

export interface TestPlan {
  overview: string;
  authDetected: boolean;
  phases: string[];
  riskAreas: string[];
  scenarios?: Scenario[];
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
  scenarioId?: string | null;
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
  scenarioId?: string | null;
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
  scenarios?: Scenario[];
  coverage?: ScenarioCoverage;
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
  autoApprove?: boolean;
  auth?: {
    loginUrl?: string;
    username: string;
    password: string;
  };
}

export interface CreateScenarioInput {
  title: string;
  goal: string;
  personaId?: string;
  viewport?: 'desktop' | 'mobile';
  needsAuth?: boolean;
  authMode?: AuthMode;
  risk?: ScenarioRisk;
  maxSteps?: number;
  expect?: string[];
  source?: ScenarioSource;
  enabled?: boolean;
}

export interface UpdateScenarioInput {
  title?: string;
  goal?: string;
  personaId?: string;
  viewport?: 'desktop' | 'mobile';
  needsAuth?: boolean;
  authMode?: AuthMode;
  risk?: ScenarioRisk;
  maxSteps?: number;
  expect?: string[];
  enabled?: boolean;
  status?: ScenarioStatus;
  verdict?: string | null;
  checks?: VerdictCheck[];
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

export interface SubmitAuthCredentialsRequest {
  emailOrUsername: string;
  password: string;
  submitSelector?: string;
}

export interface AuthPromptInfo {
  url: string;
  message?: string;
  emailSelector?: string;
  passwordSelector?: string;
  submitSelector?: string;
}
