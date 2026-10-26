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
        await el.scrollIntoViewIfNeeded().catch(() => {});

        const box = await el.boundingBox();
        if (box) {
          const x = Math.round(box.x + box.width / 2);
          const y = Math.round(box.y + box.height / 2);

          // Move virtual cursor with step animation
          await page.mouse.move(x, y, { steps: 5 });

          // Trigger visual click ripple & badge on page
          await page
            .evaluate(
              ({ x, y }) => {
                const fn = (window as any).__gremlinShowClick;
                if (fn) fn(x, y, 'CLICK', false);
              },
              { x, y }
            )
            .catch(() => {});

          await page.waitForTimeout(60);
        }

        await el.click({ timeout: 3500 });
        await page.waitForTimeout(120);
        break;
      }

      case 'double_click': {
        const el = page.locator(action.selector).first();
        await el.waitFor({ state: 'visible', timeout: 3500 });
        await el.scrollIntoViewIfNeeded().catch(() => {});

        const box = await el.boundingBox();
        if (box) {
          const x = Math.round(box.x + box.width / 2);
          const y = Math.round(box.y + box.height / 2);

          await page.mouse.move(x, y, { steps: 5 });

          await page
            .evaluate(
              ({ x, y }) => {
                const fn = (window as any).__gremlinShowClick;
                if (fn) fn(x, y, 'DOUBLE CLICK', true);
              },
              { x, y }
            )
            .catch(() => {});

          await page.waitForTimeout(60);
        }

        await el.dblclick({ timeout: 3500, delay: 50 });
        await page.waitForTimeout(120);
        break;
      }

      case 'type': {
        const el = page.locator(action.selector).first();
        await el.waitFor({ state: 'visible', timeout: 3500 });
        await el.scrollIntoViewIfNeeded().catch(() => {});

        const box = await el.boundingBox();
        if (box) {
          const x = Math.round(box.x + Math.min(box.width / 2, 40));
          const y = Math.round(box.y + box.height / 2);

          await page.mouse.move(x, y, { steps: 5 });

          await page
            .evaluate(
              ({ x, y }) => {
                const fn = (window as any).__gremlinShowClick;
                if (fn) fn(x, y, 'TYPE', false);
              },
              { x, y }
            )
            .catch(() => {});

          await page.waitForTimeout(50);
        }

        if (action.clearFirst) {
          await el.fill('');
        }
        await el.pressSequentially(action.text, { delay: 40 });
        await page.waitForTimeout(100);
        break;
      }

      case 'navigate': {
        await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout: 10000 });
        await page.waitForTimeout(200);
        break;
      }

      case 'scroll': {
        const amount = action.amount ?? 400;
        const deltaY = action.direction === 'down' ? amount : -amount;
        await page.mouse.wheel(0, deltaY);
        await page.waitForTimeout(250);
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
        await page.waitForTimeout(100);
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
