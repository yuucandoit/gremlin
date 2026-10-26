'use client';

import type { Finding, Run, RunEvent, Signal, Step } from '@gremlin/shared';
import { useEffect, useState } from 'react';
import { API_BASE } from './api';

export interface UseRunEventsState {
  run: Run | null;
  steps: Step[];
  signals: Signal[];
  findings: Finding[];
  currentProgress?: {
    currentStep: number;
    maxSteps: number;
    message?: string;
  };
  isLive: boolean;
  error?: string | null;
}

export function useRunEvents(runId: string, initialRun?: Run | null) {
  const [state, setState] = useState<UseRunEventsState>({
    run: initialRun || null,
    steps: [],
    signals: [],
    findings: [],
    isLive: false,
    error: null,
  });

  useEffect(() => {
    if (!runId) return;

    let eventSource: EventSource | null = null;
    let isMounted = true;

    try {
      const url = `${API_BASE}/runs/${runId}/events`;
      eventSource = new EventSource(url);

      eventSource.onopen = () => {
        if (!isMounted) return;
        setState((prev) => ({ ...prev, isLive: true }));
      };

      eventSource.onerror = (e) => {
        if (!isMounted) return;
        // EventSource will auto-reconnect if server closes connection or run ends
      };

      const handleEvent = (event: MessageEvent) => {
        if (!isMounted) return;
        try {
          const runEvent: RunEvent = JSON.parse(event.data);

          switch (runEvent.type) {
            case 'run:started': {
              setState((prev) => ({
                ...prev,
                run: runEvent.data.run,
                isLive: true,
              }));
              break;
            }

            case 'run:paused': {
              setState((prev) => ({
                ...prev,
                run: prev.run ? { ...prev.run, status: 'paused' } : prev.run,
              }));
              break;
            }

            case 'run:resumed': {
              setState((prev) => ({
                ...prev,
                run: prev.run ? { ...prev.run, status: 'running' } : prev.run,
              }));
              break;
            }

            case 'run:progress': {
              setState((prev) => ({
                ...prev,
                currentProgress: {
                  currentStep: runEvent.data.currentStep,
                  maxSteps: runEvent.data.maxSteps,
                  message: runEvent.data.message,
                },
              }));
              break;
            }

            case 'step:acted': {
              const newStep = runEvent.data.step;
              setState((prev) => {
                const existingIndex = prev.steps.findIndex((s) => s.id === newStep.id);
                const updatedSteps =
                  existingIndex >= 0
                    ? prev.steps.map((s, idx) => (idx === existingIndex ? newStep : s))
                    : [...prev.steps, newStep];

                return {
                  ...prev,
                  steps: updatedSteps.sort((a, b) => a.stepNumber - b.stepNumber),
                };
              });
              break;
            }

            case 'signal:detected': {
              const newSignal = runEvent.data.signal;
              setState((prev) => {
                if (prev.signals.some((s) => s.id === newSignal.id)) return prev;
                return {
                  ...prev,
                  signals: [...prev.signals, newSignal],
                };
              });
              break;
            }

            case 'finding:created': {
              const newFinding = runEvent.data.finding;
              setState((prev) => {
                if (prev.findings.some((f) => f.id === newFinding.id)) return prev;
                return {
                  ...prev,
                  findings: [...prev.findings, newFinding],
                };
              });
              break;
            }

            case 'run:completed': {
              setState((prev) => ({
                ...prev,
                run: runEvent.data.run,
                isLive: false,
              }));
              if (eventSource) eventSource.close();
              break;
            }

            case 'run:failed': {
              setState((prev) => ({
                ...prev,
                isLive: false,
                error: runEvent.data.error,
              }));
              if (eventSource) eventSource.close();
              break;
            }
          }
        } catch (err) {
          console.error('[useRunEvents] Failed parsing event data:', err);
        }
      };

      // Listen to generic messages and typed events
      eventSource.onmessage = handleEvent;
      eventSource.addEventListener('run:started', handleEvent as EventListener);
      eventSource.addEventListener('run:paused', handleEvent as EventListener);
      eventSource.addEventListener('run:resumed', handleEvent as EventListener);
      eventSource.addEventListener('run:progress', handleEvent as EventListener);
      eventSource.addEventListener('step:acted', handleEvent as EventListener);
      eventSource.addEventListener('signal:detected', handleEvent as EventListener);
      eventSource.addEventListener('finding:created', handleEvent as EventListener);
      eventSource.addEventListener('run:completed', handleEvent as EventListener);
      eventSource.addEventListener('run:failed', handleEvent as EventListener);
    } catch (err: any) {
      console.error('[useRunEvents] Connection failed:', err);
    }

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [runId]);

  return state;
}
