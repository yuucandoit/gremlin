import type { Finding, Run, Signal, Step } from './types';

export type RunEventType =
  | 'run:started'
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
  | RunProgressEvent
  | StepObservedEvent
  | StepActedEvent
  | SignalDetectedEvent
  | FindingCreatedEvent
  | RunCompletedEvent
  | RunFailedEvent
  | HeartbeatEvent;
