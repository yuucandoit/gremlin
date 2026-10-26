import type { AgentAction } from '@gremlin/shared';

export interface GuardrailContext {
  currentStep: number;
  maxSteps: number;
  startTime: number;
  timeoutMs: number;
  recentActions: AgentAction[];
  recentUrls: string[];
}

export interface GuardrailResult {
  shouldStop: boolean;
  reason?: string;
  flagLoop?: boolean;
}

export class Guardrails {
  static evaluate(ctx: GuardrailContext): GuardrailResult {
    // 1. Max steps exceeded
    if (ctx.currentStep >= ctx.maxSteps) {
      return {
        shouldStop: true,
        reason: `Reached maximum execution step limit (${ctx.maxSteps} steps).`,
      };
    }

    // 2. Global run timeout
    const elapsed = Date.now() - ctx.startTime;
    if (elapsed >= ctx.timeoutMs) {
      return {
        shouldStop: true,
        reason: `Run timed out after ${Math.round(elapsed / 1000)}s (limit: ${Math.round(ctx.timeoutMs / 1000)}s).`,
      };
    }

    // 3. Action loop detection (e.g., clicking identical selector 3 times consecutively)
    const actions = ctx.recentActions;
    if (actions.length >= 3) {
      const last3 = actions.slice(-3);
      const isIdenticalClick = last3.every(
        (a) =>
          a.type === 'click' &&
          'selector' in a &&
          'selector' in last3[0] &&
          a.selector === (last3[0] as any).selector
      );

      if (isIdenticalClick) {
        return {
          shouldStop: false,
          flagLoop: true,
          reason: `Detected repetitive click pattern on selector '${(last3[0] as any).selector}'.`,
        };
      }
    }

    // 4. URL oscillation loop (A -> B -> A -> B)
    const urls = ctx.recentUrls;
    if (urls.length >= 4) {
      const u0 = urls[urls.length - 4];
      const u1 = urls[urls.length - 3];
      const u2 = urls[urls.length - 2];
      const u3 = urls[urls.length - 1];

      if (u0 === u2 && u1 === u3 && u0 !== u1) {
        return {
          shouldStop: false,
          flagLoop: true,
          reason: `Detected URL oscillation loop between '${u0}' and '${u1}'.`,
        };
      }
    }

    return { shouldStop: false };
  }
}
