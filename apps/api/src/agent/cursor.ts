import type { Page } from 'playwright';

/**
 * Injects a high-visibility virtual cursor and click ripple effect into the page.
 * This ensures users watching the live Chromium stream can see where the agent is aiming,
 * clicking, and double-clicking in real time.
 */
export async function injectVirtualCursor(page: Page): Promise<void> {
  await page.addInitScript(() => {
    // Prevent duplicate injection
    if ((window as any).__gremlinCursorInstalled) return;
    (window as any).__gremlinCursorInstalled = true;

    // 1. Create Cursor Element
    const cursor = document.createElement('div');
    cursor.id = '__gremlin_virtual_cursor__';
    cursor.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" style="filter: drop-shadow(0 2px 6px rgba(0,0,0,0.8));">
        <path d="M5.5 3.21V20.8c0 .45.54.67.85.35l4.86-4.86a.5.5 0 0 1 .35-.15h6.87a.5.5 0 0 0 .35-.85L6.35 2.85a.5.5 0 0 0-.85.36z" fill="#10b981" stroke="#ffffff" stroke-width="1.6"/>
      </svg>
      <div id="__gremlin_action_badge__" style="display:none; position:absolute; left:22px; top:12px; background:#10b981; color:#022c22; font-weight:800; font-family:-apple-system, sans-serif; font-size:10px; padding:2px 7px; border-radius:5px; white-space:nowrap; box-shadow:0 2px 8px rgba(0,0,0,0.5); border:1px solid #ffffff; letter-spacing:0.5px;">
        ACTION
      </div>
    `;

    cursor.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 28px;
      height: 28px;
      pointer-events: none;
      z-index: 2147483647;
      transform: translate(-100px, -100px);
      transition: transform 0.08s ease-out;
      will-change: transform;
    `;

    // Append cursor as soon as document body or element is available
    function attachCursor() {
      if (document.body && !document.getElementById('__gremlin_virtual_cursor__')) {
        document.body.appendChild(cursor);
      }
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', attachCursor);
    } else {
      attachCursor();
    }

    // 2. Ripple Styles
    const style = document.createElement('style');
    style.textContent = `
      @keyframes __gremlin_ripple_anim__ {
        0% { transform: translate(-50%, -50%) scale(0.6); opacity: 1; }
        100% { transform: translate(-50%, -50%) scale(4.5); opacity: 0; }
      }
      @keyframes __gremlin_pulse_badge__ {
        0% { transform: scale(0.85); opacity: 0.5; }
        50% { transform: scale(1.15); opacity: 1; }
        100% { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);

    // 3. Helper to show click ripple & action badge
    (window as any).__gremlinShowClick = (x: number, y: number, label = 'CLICK', isDouble = false) => {
      cursor.style.transform = `translate(${x}px, ${y}px)`;

      // Show action badge
      const badge = document.getElementById('__gremlin_action_badge__');
      if (badge) {
        badge.innerText = label;
        badge.style.display = 'block';
        badge.style.background = isDouble ? '#a855f7' : label === 'TYPE' ? '#f59e0b' : '#10b981';
        badge.style.animation = '__gremlin_pulse_badge__ 0.25s ease-out';
        setTimeout(() => {
          if (badge) badge.style.display = 'none';
        }, 800);
      }

      // Create expanding ripple ring
      const ripple = document.createElement('div');
      ripple.style.cssText = `
        position: fixed;
        left: ${x}px;
        top: ${y}px;
        width: 18px;
        height: 18px;
        border-radius: 50%;
        pointer-events: none;
        z-index: 2147483646;
        transform: translate(-50%, -50%);
        background: ${isDouble ? 'rgba(168, 85, 247, 0.4)' : 'rgba(16, 185, 129, 0.4)'};
        border: 2.5px solid ${isDouble ? '#c084fc' : '#34d399'};
        box-shadow: 0 0 16px ${isDouble ? 'rgba(168, 85, 247, 0.9)' : 'rgba(16, 185, 129, 0.9)'};
        animation: __gremlin_ripple_anim__ 0.65s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
      `;
      (document.body || document.documentElement).appendChild(ripple);
      setTimeout(() => ripple.remove(), 650);
    };

    // Track mouse movements to update virtual cursor
    window.addEventListener(
      'mousemove',
      (e) => {
        cursor.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
      },
      { passive: true }
    );
  });
}
