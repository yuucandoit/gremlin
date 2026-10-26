import type { DecisionResult } from '@gremlin/shared';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ObservationData {
  url: string;
  title: string;
  personaId: string;
  stepNumber: number;
  maxSteps: number;
  interactiveElements: Array<{
    selector: string;
    tag: string;
    text: string;
    role?: string;
    type?: string;
    placeholder?: string;
    name?: string;
    disabled?: boolean;
  }>;
  recentActions: any[];
  recentSignals: any[];
}

export class LLMClient {
  private apiKey: string | undefined;
  private baseUrl: string;
  private model: string;
  private decidePromptTemplate: string;
  private reportPromptTemplate: string;

  constructor() {
    this.apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    this.baseUrl = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';
    this.model = process.env.LLM_MODEL || 'gpt-4o-mini';

    try {
      this.decidePromptTemplate = readFileSync(
        resolve(import.meta.dir, 'prompts/decide.md'),
        'utf-8'
      );
      this.reportPromptTemplate = readFileSync(
        resolve(import.meta.dir, 'prompts/report.md'),
        'utf-8'
      );
    } catch {
      this.decidePromptTemplate = '';
      this.reportPromptTemplate = '';
    }
  }

  async decideAction(
    obs: ObservationData,
    personaSystemPrompt: string
  ): Promise<DecisionResult> {
    if (this.apiKey) {
      try {
        return await this.callLLMForDecision(obs, personaSystemPrompt);
      } catch (err) {
        console.warn('[LLMClient] API call failed, using heuristic decision engine:', err);
      }
    }

    return this.heuristicDecision(obs);
  }

  private async callLLMForDecision(
    obs: ObservationData,
    personaSystemPrompt: string
  ): Promise<DecisionResult> {
    const prompt = this.decidePromptTemplate.replace(
      '{{PERSONA_SYSTEM_PROMPT}}',
      personaSystemPrompt
    );

    const userMessage = `Current URL: ${obs.url}
Page Title: ${obs.title}
Step: ${obs.stepNumber} of ${obs.maxSteps}

Recent Signals (Errors / Warnings):
${JSON.stringify(obs.recentSignals.slice(-3), null, 2)}

Recent Actions:
${JSON.stringify(obs.recentActions.slice(-3), null, 2)}

Available Interactive Elements:
${JSON.stringify(obs.interactiveElements.slice(0, 30), null, 2)}

Decide the best next action:`;

    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: userMessage },
        ],
        temperature: 0.7,
        response_format: { type: 'json_object' },
      }),
    });

    if (!res.ok) {
      throw new Error(`LLM HTTP Error: ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return {
      thought: parsed.thought || 'Executing planned exploration step.',
      action: parsed.action,
    };
  }

  private heuristicDecision(obs: ObservationData): DecisionResult {
    const { interactiveElements, personaId, stepNumber, maxSteps, recentActions } = obs;

    // Check if we should finish
    if (stepNumber >= maxSteps || interactiveElements.length === 0) {
      return {
        thought: 'Completed the exploration run or no further interactive elements detected.',
        action: { type: 'finish', reason: 'Exploration target reached' },
      };
    }

    const persona = personaId.toLowerCase();
    const clickedSelectors = new Set(
      recentActions.filter((a) => a.type === 'click' || a.type === 'double_click').map((a) => a.selector)
    );

    // 1. If there are text/number/email inputs that haven't been filled:
    const emptyInputs = interactiveElements.filter(
      (el) =>
        (el.tag === 'input' || el.tag === 'textarea') &&
        el.type !== 'submit' &&
        el.type !== 'button' &&
        !clickedSelectors.has(el.selector)
    );

    if (emptyInputs.length > 0 && Math.random() < 0.8) {
      const input = emptyInputs[0];
      let value = 'Test User';
      let thought = `Testing input field ${input.selector}`;

      if (persona.includes('gremlin')) {
        // Chaos gremlin injects emojis or crazy inputs
        const chaosInputs = ['👾 Gremlin Cart 💥', '🛒🔥', 'NaN', '999999999', '"><script>alert(1)</script>'];
        value = chaosInputs[stepNumber % chaosInputs.length];
        thought = `Gremlin injecting chaos payload into ${input.selector} to verify sanitization and encoding`;
      } else if (persona.includes('skeptic')) {
        // Skeptic inputs negative or boundary values
        const skepticInputs = ['', '-1', 'DISCOUNT99', '0', 'INVALID_PROMO'];
        value = skepticInputs[stepNumber % skepticInputs.length];
        thought = `Skeptic testing boundary and edge case value on ${input.selector}`;
      } else {
        // Happy path shopper
        if (input.name?.includes('email') || input.type === 'email') value = 'customer@example.com';
        else if (input.name?.includes('name')) value = 'Budi Santoso';
        else if (input.name?.includes('address')) value = 'Jl. MH Thamrin No. 10';
        else if (input.name?.includes('code') || input.name?.includes('coupon')) value = 'WELCOME10';
        else value = 'Jakarta, Indonesia';
        thought = `Entering standard user information into ${input.selector}`;
      }

      return {
        thought,
        action: {
          type: 'type',
          selector: input.selector,
          text: value,
          clearFirst: true,
          description: `Fill input ${input.selector}`,
        },
      };
    }

    // 2. Buttons / Links
    const buttons = interactiveElements.filter((el) => el.tag === 'button' || el.role === 'button');
    const links = interactiveElements.filter((el) => el.tag === 'a');

    // Filter unclicked buttons
    const unclickedButtons = buttons.filter((b) => !clickedSelectors.has(b.selector));
    const targetButton = unclickedButtons[0] || buttons[0];

    if (targetButton) {
      const isCheckoutOrSubmit =
        targetButton.text.toLowerCase().includes('checkout') ||
        targetButton.text.toLowerCase().includes('order') ||
        targetButton.text.toLowerCase().includes('pay') ||
        targetButton.text.toLowerCase().includes('submit') ||
        targetButton.selector.includes('checkout');

      // Gremlin or Speed Demon tries double clicks on checkout/submit buttons!
      if ((persona.includes('gremlin') || persona.includes('speed')) && isCheckoutOrSubmit) {
        return {
          thought: `Testing race condition / idempotency by rapidly double clicking '${targetButton.text}' (${targetButton.selector})`,
          action: {
            type: 'double_click',
            selector: targetButton.selector,
            description: `Double click ${targetButton.selector}`,
          },
        };
      }

      return {
        thought: `Clicking button '${targetButton.text}' (${targetButton.selector}) to progress flow`,
        action: {
          type: 'click',
          selector: targetButton.selector,
          description: `Click ${targetButton.text}`,
        },
      };
    }

    // 3. Fallback to links
    if (links.length > 0) {
      const link = links[0];
      return {
        thought: `Navigating link '${link.text}' (${link.selector})`,
        action: {
          type: 'click',
          selector: link.selector,
          description: `Follow link ${link.text}`,
        },
      };
    }

    // 4. Scroll or wait
    return {
      thought: 'Scrolling down to reveal additional viewport content.',
      action: {
        type: 'scroll',
        direction: 'down',
        amount: 400,
        description: 'Scroll viewport down',
      },
    };
  }

  async synthesizeFindings(
    signals: any[],
    steps: any[]
  ): Promise<any[]> {
    if (this.apiKey) {
      try {
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: this.reportPromptTemplate },
              {
                role: 'user',
                content: `Telemetry signals:\n${JSON.stringify(signals, null, 2)}\n\nSteps executed:\n${JSON.stringify(steps, null, 2)}`,
              },
            ],
            temperature: 0.2,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || '[]';
          return JSON.parse(content);
        }
      } catch (err) {
        console.warn('[LLMClient] Report synthesis failed, falling back to deterministic builder:', err);
      }
    }

    return [];
  }
}

export const llmClient = new LLMClient();
