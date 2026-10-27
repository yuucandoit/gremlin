import type { DecisionResult } from '@gremlin/shared';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface ObservationData {
  url: string;
  title: string;
  personaId: string;
  stepNumber: number;
  maxSteps: number;
  screenshotPath?: string;
  userGuidance?: string;
  scenarioGoal?: string;
  scenarioExpect?: string[];
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

function cleanJson(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const endIdx = cleaned.lastIndexOf('}');
    if (endIdx > firstBrace) {
      cleaned = cleaned.slice(firstBrace, endIdx + 1);
    }
  } else if (firstBracket !== -1) {
    const endIdx = cleaned.lastIndexOf(']');
    if (endIdx > firstBracket) {
      cleaned = cleaned.slice(firstBracket, endIdx + 1);
    }
  }
  return cleaned;
}

export class LLMClient {
  private apiKey: string | undefined;
  private baseUrl: string;
  private model: string;
  private museSparkModel: string;
  private museCodeModel: string;
  private samModel: string;
  private decidePromptTemplate: string;
  private reportPromptTemplate: string;

  constructor() {
    this.apiKey = process.env.META_API_KEY || process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
    this.baseUrl =
      process.env.META_MODEL_BASE_URL ||
      process.env.LLM_BASE_URL ||
      'https://api.openai.com/v1';

    // Model mappings for Meta Hackathon stack:
    // Muse Spark for Multimodal Vision & Action Decision
    this.museSparkModel =
      process.env.MUSE_SPARK_MODEL ||
      process.env.LLM_MODEL ||
      'meta-muse/muse-spark';

    // Muse Code for Root Cause Synthesis & Regression Test Generation
    this.museCodeModel =
      process.env.MUSE_CODE_MODEL ||
      process.env.LLM_MODEL ||
      'meta-muse/muse-code';

    // SAM 3.1 for Visual Defect Bounding Box & Anomaly Segmentation
    this.samModel = process.env.SAM_MODEL || 'meta-sam/sam-3.1';

    this.model = this.museSparkModel;

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

  hasLLMConfigured(): boolean {
    return !!this.apiKey;
  }

  getModelName(): string {
    return this.model;
  }

  getMetaModels() {
    return {
      spark: this.museSparkModel,
      code: this.museCodeModel,
      sam: this.samModel,
    };
  }

  async decideAction(
    obs: ObservationData,
    personaSystemPrompt: string
  ): Promise<DecisionResult> {
    if (this.apiKey) {
      try {
        console.log(`[Gremlin AI] 🧠 Querying Meta Muse Spark (${this.museSparkModel}) with Vision for step ${obs.stepNumber}/${obs.maxSteps}...`);
        const result = await this.callLLMForDecision(obs, personaSystemPrompt);
        console.log(`[Gremlin AI] 💡 Model Thought: "${result.thought}"`);
        console.log(`[Gremlin AI] 🎯 Decided Action: ${result.action.type} ${'selector' in result.action ? `-> ${result.action.selector}` : ''}`);
        return result;
      } catch (err) {
        console.warn(`[Gremlin AI] ⚠️ API call to ${this.museSparkModel} failed, falling back to autonomous heuristic:`, err);
      }
    } else {
      console.log(`[Gremlin AI] ⚡ Autonomous heuristic engine active (no LLM_API_KEY found)`);
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
Step: ${obs.stepNumber} of ${obs.maxSteps}${
      obs.scenarioGoal
        ? `\n\n🎯 [ACTIVE TEST SCENARIO GOAL]: "${obs.scenarioGoal}"\nEXPECTED PASS CRITERIA: ${obs.scenarioExpect?.join('; ') || 'No crashes'}\nPrioritize testing this scenario goal directly!`
        : ''
    }${
      obs.userGuidance
        ? `\n\n🎯 [HUMAN CO-PILOT STEERING GUIDANCE]: The QA engineer explicitly commanded: "${obs.userGuidance}". Prioritize testing this instruction immediately.`
        : ''
    }

Recent Signals (Errors / Warnings):
${JSON.stringify(obs.recentSignals.slice(-3), null, 2)}

Recent Actions:
${JSON.stringify(obs.recentActions.slice(-3), null, 2)}

Available Interactive Elements:
${JSON.stringify(obs.interactiveElements.slice(0, 30), null, 2)}

Decide the best next action:`;

    // Multimodal Vision: Check if screenshot is available
    const userContent: any[] = [{ type: 'text', text: userMessage }];
    let hasVision = false;

    if (obs.screenshotPath && existsSync(obs.screenshotPath)) {
      try {
        const imageBuffer = readFileSync(obs.screenshotPath);
        const base64 = imageBuffer.toString('base64');
        userContent.push({
          type: 'image_url',
          image_url: {
            url: `data:image/png;base64,${base64}`,
          },
        });
        hasVision = true;
      } catch (e) {
        console.warn('[LLMClient] Failed encoding screenshot for vision input:', e);
      }
    }

    // Attempt multimodal vision request
    let res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.museSparkModel,
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: hasVision ? userContent : userMessage },
        ],
        temperature: 0.7,
      }),
    });

    // If model returned 400 (e.g. text-only model rejects image_url), retry with text-only
    if (!res.ok && hasVision) {
      console.log('[LLMClient] Vision rejected by endpoint, falling back to text-only prompt...');
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.museSparkModel,
          messages: [
            { role: 'system', content: prompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0.7,
        }),
      });
    }

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(`LLM HTTP Error: ${res.status} ${res.statusText} - ${errText}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(cleanJson(content));

    return {
      thought: parsed.thought || 'Executing planned exploration step.',
      action: parsed.action,
    };
  }

  async generateReconPlan(prompt: string): Promise<any> {
    if (!this.apiKey) return null;

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.museSparkModel,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
        }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || '{}';
      return JSON.parse(cleanJson(content));
    } catch {
      return null;
    }
  }

  private heuristicDecision(obs: ObservationData): DecisionResult {
    const { interactiveElements, personaId, stepNumber, maxSteps, recentActions, scenarioGoal, userGuidance } = obs;

    if (stepNumber >= maxSteps || interactiveElements.length === 0) {
      return {
        thought: 'Completed the exploration run or no further interactive elements detected.',
        action: { type: 'finish', reason: 'Exploration target reached' },
      };
    }

    const persona = personaId.toLowerCase();
    const goal = (scenarioGoal || '').toLowerCase();
    const guidance = (userGuidance || '').toLowerCase();
    const clickedSelectors = new Set(
      recentActions.filter((a) => a.type === 'click' || a.type === 'double_click').map((a) => a.selector)
    );
    const typedSelectors = new Set(
      recentActions.filter((a) => a.type === 'type').map((a) => a.selector)
    );

    // --- GOAL-DIRECTED HEURISTICS ---
    // 1. Coupon / Promo targeted test
    if (goal.includes('kupon') || goal.includes('coupon') || goal.includes('promo') || guidance.includes('kupon')) {
      const couponInput = interactiveElements.find(
        (el) =>
          (el.tag === 'input' || el.tag === 'textarea') &&
          (el.name?.toLowerCase().includes('coupon') ||
            el.name?.toLowerCase().includes('kupon') ||
            el.name?.toLowerCase().includes('code') ||
            el.name?.toLowerCase().includes('promo') ||
            el.placeholder?.toLowerCase().includes('kupon') ||
            el.placeholder?.toLowerCase().includes('coupon') ||
            el.selector.toLowerCase().includes('coupon') ||
            el.selector.toLowerCase().includes('kupon'))
      );

      if (couponInput && !typedSelectors.has(couponInput.selector)) {
        const val = persona.includes('skeptic') ? 'INVALID_PROMO' : 'WELCOME10';
        return {
          thought: `Targeting coupon scenario: filling '${val}' into ${couponInput.selector} to verify discount logic`,
          action: {
            type: 'type',
            selector: couponInput.selector,
            text: val,
            clearFirst: true,
            description: `Input kupon ${val}`,
          },
        };
      }

      const applyCouponBtn = interactiveElements.find(
        (el) =>
          (el.tag === 'button' || el.role === 'button') &&
          (el.text.toLowerCase().includes('gunakan') ||
            el.text.toLowerCase().includes('terapkan') ||
            el.text.toLowerCase().includes('apply') ||
            el.selector.toLowerCase().includes('coupon') ||
            el.selector.toLowerCase().includes('kupon'))
      );
      if (applyCouponBtn && !clickedSelectors.has(applyCouponBtn.selector)) {
        return {
          thought: `Targeting coupon scenario: submitting coupon via ${applyCouponBtn.selector}`,
          action: {
            type: 'click',
            selector: applyCouponBtn.selector,
            description: `Click ${applyCouponBtn.text}`,
          },
        };
      }
    }

    // 2. Checkout / Double Click / Race condition targeted test
    if (
      goal.includes('double') ||
      goal.includes('race') ||
      goal.includes('checkout') ||
      goal.includes('ganda') ||
      goal.includes('cepat')
    ) {
      const checkoutBtn = interactiveElements.find(
        (el) =>
          (el.tag === 'button' || el.role === 'button') &&
          (el.text.toLowerCase().includes('checkout') ||
            el.text.toLowerCase().includes('order') ||
            el.text.toLowerCase().includes('bayar') ||
            el.text.toLowerCase().includes('pesan') ||
            el.selector.toLowerCase().includes('checkout'))
      );

      if (checkoutBtn) {
        return {
          thought: `Targeting race condition: rapidly double-clicking checkout button '${checkoutBtn.text}' (${checkoutBtn.selector})`,
          action: {
            type: 'double_click',
            selector: checkoutBtn.selector,
            description: `Double click ${checkoutBtn.selector}`,
          },
        };
      }

      // If checkout button not found, maybe we need to add to cart first
      const addToCartBtn = interactiveElements.find(
        (el) =>
          (el.tag === 'button' || el.role === 'button') &&
          (el.text.toLowerCase().includes('tambah') ||
            el.text.toLowerCase().includes('cart') ||
            el.text.toLowerCase().includes('keranjang') ||
            el.selector.toLowerCase().includes('add-to-cart'))
      );
      if (addToCartBtn) {
        return {
          thought: `Preparing checkout scenario: adding product to cart via '${addToCartBtn.text}' (${addToCartBtn.selector})`,
          action: {
            type: 'click',
            selector: addToCartBtn.selector,
            description: `Click ${addToCartBtn.text}`,
          },
        };
      }
    }

    // 3. Login test scenario
    if (goal.includes('login') || goal.includes('masuk') || goal.includes('auth')) {
      const emailInput = interactiveElements.find(
        (el) =>
          (el.tag === 'input' || el.tag === 'textarea') &&
          (el.type === 'email' || el.name?.toLowerCase().includes('email') || el.name?.toLowerCase().includes('user')) &&
          !typedSelectors.has(el.selector)
      );
      if (emailInput) {
        const val = goal.includes('salah') || goal.includes('invalid') ? 'nonexistent@example.com' : 'demo@glitchmart.local';
        return {
          thought: `Targeting login scenario: entering email into ${emailInput.selector}`,
          action: {
            type: 'type',
            selector: emailInput.selector,
            text: val,
            clearFirst: true,
            description: `Enter email into ${emailInput.selector}`,
          },
        };
      }

      const passInput = interactiveElements.find(
        (el) =>
          el.tag === 'input' &&
          el.type === 'password' &&
          !typedSelectors.has(el.selector)
      );
      if (passInput) {
        return {
          thought: `Targeting login scenario: entering password into ${passInput.selector}`,
          action: {
            type: 'type',
            selector: passInput.selector,
            text: 'wrongpass123',
            clearFirst: true,
            description: `Enter password into ${passInput.selector}`,
          },
        };
      }

      const submitLogin = interactiveElements.find(
        (el) =>
          (el.tag === 'button' || el.type === 'submit') &&
          (el.text.toLowerCase().includes('login') ||
            el.text.toLowerCase().includes('masuk') ||
            el.selector.toLowerCase().includes('login') ||
            el.selector.toLowerCase().includes('submit'))
      );
      if (submitLogin) {
        return {
          thought: `Targeting login scenario: submitting login form via ${submitLogin.selector}`,
          action: {
            type: 'click',
            selector: submitLogin.selector,
            description: `Click ${submitLogin.text}`,
          },
        };
      }
    }

    // --- DEFAULT PERSONA EXPLORATION ---
    // 1. Inputs
    const emptyInputs = interactiveElements.filter(
      (el) =>
        (el.tag === 'input' || el.tag === 'textarea') &&
        el.type !== 'submit' &&
        el.type !== 'button' &&
        !typedSelectors.has(el.selector)
    );

    if (emptyInputs.length > 0 && Math.random() < 0.8) {
      const input = emptyInputs[0];
      let value = 'Test User';
      let thought = `Testing input field ${input.selector}`;

      if (persona.includes('gremlin')) {
        const chaosInputs = ['👾 Gremlin Cart 💥', '🛒🔥', 'NaN', '999999999', '"><script>alert(1)</script>'];
        value = chaosInputs[stepNumber % chaosInputs.length];
        thought = `Gremlin injecting chaos payload into ${input.selector} to verify sanitization and encoding`;
      } else if (persona.includes('skeptic')) {
        const skepticInputs = ['', '-1', 'DISCOUNT99', '0', 'INVALID_PROMO'];
        value = skepticInputs[stepNumber % skepticInputs.length];
        thought = `Skeptic testing boundary and edge case value on ${input.selector}`;
      } else {
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

    const unclickedButtons = buttons.filter((b) => !clickedSelectors.has(b.selector));
    const targetButton = unclickedButtons[0] || buttons[0];

    if (targetButton) {
      const isCheckoutOrSubmit =
        targetButton.text.toLowerCase().includes('checkout') ||
        targetButton.text.toLowerCase().includes('order') ||
        targetButton.text.toLowerCase().includes('pay') ||
        targetButton.text.toLowerCase().includes('submit') ||
        targetButton.selector.includes('checkout');

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
        console.log(`[Gremlin AI] 🔍 Synthesizing findings with Meta Muse Code (${this.museCodeModel})...`);
        const res = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.museCodeModel,
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
          const parsed = JSON.parse(cleanJson(content));
          console.log(`[Gremlin AI] ✅ Successfully synthesized ${parsed.length} findings via ${this.museCodeModel}`);
          return parsed;
        }
      } catch (err) {
        console.warn(`[Gremlin AI] ⚠️ Report synthesis via ${this.museCodeModel} failed, falling back to deterministic builder:`, err);
      }
    }

    return [];
  }
}

export const llmClient = new LLMClient();
