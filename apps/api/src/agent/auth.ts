import type { Page } from 'playwright';

export interface LoginSelectors {
  userSelector?: string;
  passSelector?: string;
  submitSelector?: string;
}

export interface LoginWallResult {
  isLoginWall: boolean;
  selectors: LoginSelectors;
}

/**
 * Detects if the current page presents an authentication wall or login form.
 */
export async function detectLoginWall(page: Page): Promise<LoginWallResult> {
  try {
    const url = page.url().toLowerCase();
    const isAuthUrl =
      url.includes('/login') ||
      url.includes('/signin') ||
      url.includes('/masuk') ||
      url.includes('/auth');

    const result = await page.evaluate((authUrlDetected) => {
      const passInput = document.querySelector('input[type="password"]') as HTMLInputElement | null;

      // Find user/email field
      const userSelectors = [
        'input[type="email"]',
        'input[name*="email" i]',
        'input[id*="email" i]',
        'input[name*="user" i]',
        'input[id*="user" i]',
        'input[placeholder*="email" i]',
        'input[placeholder*="username" i]',
        'input[type="text"]',
      ];

      let userInput: HTMLInputElement | null = null;
      let userSel: string | undefined;

      for (const sel of userSelectors) {
        const el = document.querySelector(sel) as HTMLInputElement | null;
        if (el && el !== passInput && el.offsetParent !== null) {
          userInput = el;
          userSel = el.id ? `#${el.id}` : el.name ? `input[name="${el.name}"]` : sel;
          break;
        }
      }

      // Find submit button
      const submitSelectors = [
        'button[type="submit"]',
        'input[type="submit"]',
        'button:has-text("Login")',
        'button:has-text("Masuk")',
        'button:has-text("Sign in")',
      ];

      let submitSel: string | undefined;
      const buttons = Array.from(document.querySelectorAll('button, input[type="submit"]'));
      for (const btn of buttons) {
        const text = btn.textContent?.toLowerCase() || '';
        const isSubmit = (btn as HTMLInputElement).type === 'submit';
        if (
          isSubmit ||
          text.includes('login') ||
          text.includes('masuk') ||
          text.includes('sign in') ||
          text.includes('log in')
        ) {
          submitSel = btn.id ? `#${btn.id}` : `button:has-text("${btn.textContent?.trim() || 'Login'}")`;
          break;
        }
      }

      const passSel = passInput ? (passInput.id ? `#${passInput.id}` : 'input[type="password"]') : undefined;
      const isWall = (passInput !== null && passInput.offsetParent !== null) || (authUrlDetected && userInput !== null);

      return {
        isLoginWall: Boolean(isWall),
        selectors: {
          userSelector: userSel,
          passSelector: passSel,
          submitSelector: submitSel,
        },
      };
    }, isAuthUrl);

    return result;
  } catch (err) {
    console.warn('[Auth] detectLoginWall error:', err);
    return { isLoginWall: false, selectors: {} };
  }
}

/**
 * Robust check if user is logged into the application.
 * Verifies cookie/localStorage tokens, disappearance of login wall, and presence of profile/logout elements.
 */
export async function isLoggedIn(page: Page): Promise<boolean> {
  try {
    if (!page || typeof page.url !== 'function') return false;
    const url = page.url().toLowerCase();
    const isLoginUrl = url.includes('/login') || url.includes('/signin') || url.includes('/auth');

    // 1. Check cookies for auth token
    const cookies = await page.context().cookies();
    const hasAuthCookie = cookies.some((c) => {
      const name = c.name.toLowerCase();
      return (
        name.includes('token') ||
        name.includes('auth') ||
        name.includes('session') ||
        name.includes('jwt') ||
        name.includes('user')
      );
    });

    // 2. Check localStorage in page context
    const hasStorageToken = await page
      .evaluate(() => {
        try {
          const keys = Object.keys(localStorage);
          return keys.some((k) => {
            const kl = k.toLowerCase();
            return (
              kl.includes('auth') ||
              kl.includes('token') ||
              kl.includes('session') ||
              kl.includes('jwt') ||
              kl.includes('user')
            );
          });
        } catch {
          return false;
        }
      })
      .catch(() => false);

    // 3. Check DOM indicator (logout button, avatar, user menu)
    const hasDomIndicator = await page
      .evaluate(() => {
        const textNodes = document.body ? document.body.innerText.toLowerCase() : '';
        const hasLogoutText = textNodes.includes('logout') || textNodes.includes('keluar') || textNodes.includes('sign out');
        const hasPasswordInput = document.querySelector('input[type="password"]') !== null;
        return hasLogoutText || (!hasPasswordInput && Boolean(document.querySelector('[data-testid*="user"], [class*="avatar"], [id*="profile"]')));
      })
      .catch(() => false);

    if (hasAuthCookie || hasStorageToken) {
      return true;
    }

    if (!isLoginUrl && hasDomIndicator) {
      return true;
    }

    return false;
  } catch (err) {
    console.warn('[Auth] isLoggedIn error:', err);
    return false;
  }
}

/**
 * Performs automated login on the given page using provided credentials.
 * Does NOT log or leak passwords into step logs or database.
 */
export async function performLogin(
  page: Page,
  creds: { username: string; password: string },
  selectors?: LoginSelectors
): Promise<{ success: boolean; message: string }> {
  try {
    let userSel = selectors?.userSelector;
    let passSel = selectors?.passSelector;
    let submitSel = selectors?.submitSelector;

    if (!userSel || !passSel || !submitSel) {
      const detected = await detectLoginWall(page);
      userSel = userSel || detected.selectors.userSelector || 'input[type="email"], input[name*="user"], input[type="text"]';
      passSel = passSel || detected.selectors.passSelector || 'input[type="password"]';
      submitSel = submitSel || detected.selectors.submitSelector || 'button[type="submit"], input[type="submit"]';
    }

    // Fill username
    await page.fill(userSel, creds.username, { timeout: 5000 });

    // Fill password
    await page.fill(passSel, creds.password, { timeout: 5000 });

    // Click submit
    await page.click(submitSel, { timeout: 5000 });

    // Wait for network idle or DOM navigation
    await page.waitForLoadState('networkidle', { timeout: 7000 }).catch(() => {});
    await page.waitForTimeout(1000);

    const loggedIn = await isLoggedIn(page);
    if (loggedIn) {
      return { success: true, message: 'Autentikasi berhasil!' };
    } else {
      // Check for error messages
      const errorText = await page.evaluate(() => {
        const errorEl = document.querySelector('.error, [role="alert"], [class*="error"], [id*="error"]');
        return errorEl ? errorEl.textContent?.trim() : null;
      });
      return {
        success: false,
        message: errorText || 'Autentikasi gagal: halaman belum menunjukkan status logged in.',
      };
    }
  } catch (err: any) {
    return {
      success: false,
      message: `Login error: ${err?.message || err}`,
    };
  }
}
