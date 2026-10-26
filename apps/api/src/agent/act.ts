import type { AgentAction } from '@gremlin/shared';
import type { Page } from 'playwright';

export interface ActionResult {
  success: boolean;
  durationMs: number;
  error?: string;
}

export async function executeAction(page: Page, action: AgentAction): Promise<ActionResult> {
  const start = Date.now();

  try {
    switch (action.type) {
      case 'click': {
        const el = page.locator(action.selector).first();
        await el.waitFor({ state: 'visible', timeout: 3500 });
        await el.click({ timeout: 3500 });
        break;
      }

      case 'double_click': {
        const el = page.locator(action.selector).first();
        await el.waitFor({ state: 'visible', timeout: 3500 });
        await el.dblclick({ timeout: 3500, delay: 50 });
        break;
      }

      case 'type': {
        const el = page.locator(action.selector).first();
        await el.waitFor({ state: 'visible', timeout: 3500 });
        if (action.clearFirst) {
          await el.fill('');
        }
        await el.pressSequentially(action.text, { delay: 30 });
        break;
      }

      case 'navigate': {
        await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        break;
      }

      case 'scroll': {
        const amount = action.amount ?? 400;
        const deltaY = action.direction === 'down' ? amount : -amount;
        await page.mouse.wheel(0, deltaY);
        await page.waitForTimeout(200);
        break;
      }

      case 'wait': {
        await page.waitForTimeout(Math.min(action.ms, 5000));
        break;
      }

      case 'press_key': {
        if (action.selector) {
          const el = page.locator(action.selector).first();
          await el.focus();
        }
        await page.keyboard.press(action.key);
        break;
      }

      case 'finish': {
        // No browser action needed
        break;
      }

      default:
        throw new Error(`Unsupported action type: ${(action as any).type}`);
    }

    return {
      success: true,
      durationMs: Date.now() - start,
    };
  } catch (err: any) {
    return {
      success: false,
      durationMs: Date.now() - start,
      error: err?.message || String(err),
    };
  }
}
