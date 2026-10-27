import type { Finding, Run, Scenario, Signal, Step, TestPlan } from './types';

export type RunEventType =
  | 'run:started'
  | 'run:planning'
  | 'run:paused'
  | 'run:resumed'
  | 'auth:required'
  | 'auth:resolved'
  | 'test_plan:ready'
  | 'scenario:created'
  | 'scenario:updated'
  | 'scenario:deleted'
  | 'run:progress'
  | 'step:observed'
  | 'step:acted'
  | 'signal:detected'
  | 'finding:created'
  | 'run:completed'
  | 'run:failed'
  | 'heartbeat';

export interface BaseRunEvent<TType extends RunEventType, TPayload> {
  type: TType;
  runId: string;
  timestamp: string;
  data: TPayload;
}

export type RunStartedEvent = BaseRunEvent<'run:started', { run: Run }>;

export type RunPlanningEvent = BaseRunEvent<'run:planning', { runId: string; message?: string }>;

export type RunPausedEvent = BaseRunEvent<'run:paused', { runId: string }>;

export type RunResumedEvent = BaseRunEvent<'run:resumed', { runId: string }>;

export type AuthRequiredEvent = BaseRunEvent<
  'auth:required',
  {
    url: string;
    message?: string;
    emailSelector?: string;
    passwordSelector?: string;
    submitSelector?: string;
  }
>;

export type AuthResolvedEvent = BaseRunEvent<
  'auth:resolved',
  {
    success: boolean;
    email?: string;
    message?: string;
  }
>;

export type TestPlanReadyEvent = BaseRunEvent<'test_plan:ready', { testPlan: TestPlan; scenarios?: Scenario[] }>;

export type ScenarioCreatedEvent = BaseRunEvent<'scenario:created', { scenario: Scenario }>;

export type ScenarioUpdatedEvent = BaseRunEvent<'scenario:updated', { scenario: Scenario }>;

export type ScenarioDeletedEvent = BaseRunEvent<'scenario:deleted', { scenarioId: string }>;

export type RunProgressEvent = BaseRunEvent<
  'run:progress',
  {
    currentStep: number;
    maxSteps: number;
    status: string;
    message?: string;
  }
>;

export type StepObservedEvent = BaseRunEvent<'step:observed', { step: Step }>;

export type StepActedEvent = BaseRunEvent<
  'step:acted',
  {
    step: Step;
    nextSelector?: string;
  }
>;

export type SignalDetectedEvent = BaseRunEvent<'signal:detected', { signal: Signal }>;

export type FindingCreatedEvent = BaseRunEvent<'finding:created', { finding: Finding }>;

export type RunCompletedEvent = BaseRunEvent<
  'run:completed',
  {
    run: Run;
    totalSteps: number;
    totalSignals: number;
    totalFindings: number;
  }
>;

export type RunFailedEvent = BaseRunEvent<'run:failed', { runId: string; error: string }>;

export type HeartbeatEvent = BaseRunEvent<'heartbeat', { count: number }>;

export type RunEvent =
  | RunStartedEvent
  | RunPlanningEvent
  | RunPausedEvent
  | RunResumedEvent
  | AuthRequiredEvent
  | AuthResolvedEvent
  | TestPlanReadyEvent
  | ScenarioCreatedEvent
  | ScenarioUpdatedEvent
  | ScenarioDeletedEvent
  | RunProgressEvent
  | StepObservedEvent
  | StepActedEvent
  | SignalDetectedEvent
  | FindingCreatedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | HeartbeatEvent;
