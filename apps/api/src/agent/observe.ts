import type { Page } from 'playwright';
import { storage } from '../lib/storage';

export interface InteractiveElement {
  selector: string;
  tag: string;
  text: string;
  role?: string;
  type?: string;
  placeholder?: string;
  name?: string;
  disabled?: boolean;
}

export interface Observation {
  url: string;
  title: string;
  screenshotPath: string;
  ariaSnapshot?: string;
  interactiveElements: InteractiveElement[];
}

export async function observePage(
  page: Page,
  runId: string,
  stepNumber: number
): Promise<Observation> {
  const url = page.url();
  const title = await page.title().catch(() => '');

  // 1. Capture screenshot to data/runs/{id}/steps/{stepNumber}.png
  const screenshotPath = storage.getStepScreenshotPath(runId, stepNumber);
  await page.screenshot({ path: screenshotPath, fullPage: false }).catch((err) => {
    console.warn(`[Observe] Screenshot failed:`, err);
  });

  // 2. Capture ARIA / Accessibility snapshot
  let ariaSnapshot = '';
  try {
    const snapshot = await page.accessibility.snapshot();
    if (snapshot) {
      ariaSnapshot = JSON.stringify(snapshot, null, 2);
    }
  } catch {
    // Accessibility API might fail on certain frames
  }

  // 3. Extract interactive elements with clean selectors
  const interactiveElements = await page
    .evaluate(() => {
      const results: any[] = [];
      const seen = new Set<string>();

      function getCleanSelector(el: HTMLElement): string {
        if (el.id) return `#${el.id}`;
        const testId = el.getAttribute('data-testid');
        if (testId) return `[data-testid="${testId}"]`;
        const name = el.getAttribute('name');
        if (name) return `${el.tagName.toLowerCase()}[name="${name}"]`;
        if (el.className && typeof el.className === 'string') {
          const firstClass = el.className.split(' ').filter(Boolean)[0];
          if (firstClass) return `${el.tagName.toLowerCase()}.${firstClass}`;
        }
        return el.tagName.toLowerCase();
      }

      // Query clickable & form elements
      const elements = Array.from(
        document.querySelectorAll(
          'button, a, input, select, textarea, [role="button"], [role="link"], [role="tab"]'
        )
      ) as HTMLElement[];

      for (const el of elements) {
        // Filter hidden elements
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          continue;
        }

        const selector = getCleanSelector(el);
        if (seen.has(selector)) continue;
        seen.add(selector);

        results.push({
          selector,
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.getAttribute('value') || el.getAttribute('aria-label') || '').slice(0, 50).trim(),
          role: el.getAttribute('role') || undefined,
          type: (el as HTMLInputElement).type || undefined,
          placeholder: (el as HTMLInputElement).placeholder || undefined,
          name: el.getAttribute('name') || undefined,
          disabled: (el as HTMLButtonElement).disabled || false,
        });

        if (results.length >= 40) break;
      }

      return results;
    })
    .catch(() => []);

  return {
    url,
    title,
    screenshotPath,
    ariaSnapshot,
    interactiveElements,
  };
}
