import type { Scenario, TestPlan } from '@gremlin/shared';
import type { Page } from 'playwright';
import { llmClient } from '../llm/client';
import { scenariosRepo } from '../db/repo/scenarios';

export interface ReconResult {
  testPlan: TestPlan;
  scenarios: Scenario[];
}

export async function conductReconnaissance(
  page: Page,
  runId: string,
  targetUrl: string,
  personaName: string
): Promise<ReconResult> {
  const pageTitle = await page.title().catch(() => '');
  const pageUrl = page.url();

  // Inspect page characteristics
  const pageAnalysis = await page
    .evaluate(() => {
      const text = document.body?.innerText?.toLowerCase() || '';
      const hasAuth =
        text.includes('login') ||
        text.includes('sign in') ||
        text.includes('masuk') ||
        !!document.querySelector('input[type="password"]');
      const hasCart =
        text.includes('cart') ||
        text.includes('checkout') ||
        text.includes('keranjang') ||
        text.includes('order');
      const hasForms = document.querySelectorAll('form, input').length > 0;
      const buttons = Array.from(document.querySelectorAll('button, a')).map((b) =>
        (b.textContent || '').trim().slice(0, 30)
      );

      return { hasAuth, hasCart, hasForms, textSample: text.slice(0, 300), buttonSamples: buttons.slice(0, 10) };
    })
    .catch(() => ({ hasAuth: false, hasCart: false, hasForms: false, textSample: '', buttonSamples: [] }));

  // Deterministic Base Scenarios (templates)
  const templateScenarios: Array<Omit<Scenario, 'id' | 'runId' | 'idx' | 'createdAt'>> = [];

  // 1. Audit Visual & Responsiveness
  templateScenarios.push({
    title: 'Audit Visual Responsif & Layout Mobile/Desktop',
    goal: 'Verifikasi tidak ada teks bertumpuk, tombol terpotong, atau overflow kontras buruk pada viewport',
    personaId: 'gremlin',
    viewport: 'desktop',
    needsAuth: false,
    authMode: 'none',
    risk: 'low',
    maxSteps: 6,
    expect: [
      'Tidak ada teks bertumpuk atau elemen terpotong',
      'Kontras elemen visual memenuhi standar kenyamanan membaca',
      'Tidak ada overflow horizontal yang tidak disengaja',
    ],
    source: 'template',
    enabled: true,
    status: 'pending',
  });

  // 2. Exploration & Dead Clicks
  templateScenarios.push({
    title: 'Eksplorasi Navigasi & Probing Dead Click',
    goal: 'Jelajahi link dan tombol navigasi utama untuk menemukan elemen interaktif yang tidak merespons',
    personaId: 'gremlin',
    viewport: 'desktop',
    needsAuth: false,
    authMode: 'none',
    risk: 'low',
    maxSteps: 8,
    expect: [
      'Semua elemen interaktif merespons klik tanpa freeze',
      'Tidak ada unhandled exception atau console error',
      'Tidak ada request network HTTP 500',
    ],
    source: 'template',
    enabled: true,
    status: 'pending',
  });

  // 3. E-Commerce Cart / Checkout Flow (if detected)
  if (pageAnalysis.hasCart) {
    templateScenarios.push({
      title: 'Uji Eksplorasi Keranjang & Batas Jumlah Produk',
      goal: 'Tambahkan produk ke keranjang belanja dan uji boundary jumlah (0, negatif, nilai ekstrem)',
      personaId: 'skeptic',
      viewport: 'desktop',
      needsAuth: false,
      authMode: 'none',
      risk: 'low',
      maxSteps: 8,
      expect: [
        'Total harga keranjang terhitung dengan akurat',
        'Jumlah barang tidak dapat diubah ke angka negatif',
        'Tidak ada server crash atau 500 error',
      ],
      source: 'template',
      enabled: true,
      status: 'pending',
    });

    templateScenarios.push({
      title: 'Checkout Cepat & Idempotency Double-Click',
      goal: 'Klik tombol checkout atau Place Order dengan cepat dua kali untuk menguji race condition',
      personaId: 'speed_demon',
      viewport: 'desktop',
      needsAuth: false,
      authMode: 'none',
      risk: 'low',
      maxSteps: 6,
      expect: [
        'Hanya 1 pesanan terbuat tanpa duplikasi order',
        'Tombol terdisable setelah klik pertama untuk mencegah double submit',
        'Tidak ada error internal 500',
      ],
      source: 'template',
      enabled: true,
      status: 'pending',
    });

    templateScenarios.push({
      title: 'Fuzzing Kupon Diskon & Karakter Khusus',
      goal: 'Masukkan input ekstrem pada kolom kupon/promo seperti DISCOUNT99, NaN, dan karakter spesial',
      personaId: 'skeptic',
      viewport: 'desktop',
      needsAuth: false,
      authMode: 'none',
      risk: 'low',
      maxSteps: 6,
      expect: [
        'Kupon tidak valid menampilkan pesan peringatan ramah pengguna',
        'Tidak memicu unhandled rejection atau crash server',
      ],
      source: 'template',
      enabled: true,
      status: 'pending',
    });

    // High risk action: disabled by default as per rule
    templateScenarios.push({
      title: 'Proses Pembayaran Nyata & Finalisasi Transaksi',
      goal: 'Kirim data pembayaran riil untuk memverifikasi settlement akhir',
      personaId: 'gremlin',
      viewport: 'desktop',
      needsAuth: false,
      authMode: 'none',
      risk: 'high',
      maxSteps: 8,
      expect: [
        'Halaman konfirmasi transaksi muncul dengan nomor ref order valid',
        'Data pembayaran terenkripsi dengan aman',
      ],
      source: 'template',
      enabled: false, // HIGH RISK: OFF by default
      status: 'pending',
    });
  }

  // 4. Authentication Flow (if detected)
  if (pageAnalysis.hasAuth) {
    templateScenarios.push({
      title: 'Verifikasi Form Login & Pencegahan Enumerasi Akun',
      goal: 'Uji form otentikasi dengan kredensial salah untuk memeriksa kebocoran data pengguna',
      personaId: 'skeptic',
      viewport: 'desktop',
      needsAuth: false,
      authMode: 'tests_login',
      risk: 'low',
      maxSteps: 6,
      expect: [
        'Pesan error netral dan tidak membocorkan apakah email terdaftar',
        'Form tidak mengalami crash pada input panjang',
      ],
      source: 'template',
      enabled: true,
      status: 'pending',
    });

    templateScenarios.push({
      title: 'Proteksi Rute Internal & Manajemen Sesi',
      goal: 'Coba akses dashboard atau rute terproteksi tanpa sesi otentikasi aktif',
      personaId: 'gremlin',
      viewport: 'desktop',
      needsAuth: true,
      authMode: 'requires',
      risk: 'medium',
      maxSteps: 6,
      expect: [
        'Akses unauthenticated dialihkan ke login secara mulus',
        'Data sensitif tidak dapat diakses tanpa token/kuki aktif',
      ],
      source: 'template',
      enabled: true,
      status: 'pending',
    });
  }

  let testPlan: TestPlan = {
    overview: pageAnalysis.hasCart
      ? `Online storefront with interactive checkout flow and product catalog.`
      : `Interactive web application at ${pageUrl}.`,
    authDetected: pageAnalysis.hasAuth,
    phases: [
      'Phase 1: Discovery & Visual Contrast Audit',
      pageAnalysis.hasCart ? 'Phase 2: Shopping Funnel & Boundary Testing' : 'Phase 2: Form Input Boundary Fuzzing',
      'Phase 3: Chaos Injection & Race Condition Probing (rapid clicks)',
      'Phase 4: Synthesis & Playwright Regression Test Generation',
    ],
    riskAreas: [
      pageAnalysis.hasCart ? 'Race condition on double-click checkout' : 'Unresponsive interactive elements',
      'Unhandled client-side Unicode/Emoji rendering exceptions',
      'Server-side 500 exceptions on boundary coupon inputs',
    ],
  };

  // LLM Meta Muse Spark Augmentation if available
  if (llmClient.hasLLMConfigured()) {
    try {
      const prompt = `You are Meta Muse Spark, an autonomous QA strategist.
Analyze this web target:
URL: ${pageUrl}
Title: ${pageTitle}
Auth: ${pageAnalysis.hasAuth}
Cart/Checkout: ${pageAnalysis.hasCart}
Persona: ${personaName}

Formulate strategic reconnaissance summary in JSON:
{
  "overview": "Scope description",
  "phases": ["Phase 1: ...", "Phase 2: ..."],
  "riskAreas": ["Risk 1: ...", "Risk 2: ..."],
  "customScenarios": [
    {
      "title": "Short title",
      "goal": "Clear operational test goal",
      "personaId": "gremlin",
      "risk": "low",
      "maxSteps": 6,
      "expect": ["Criteria 1", "Criteria 2"],
      "needsAuth": false
    }
  ]
}
Return raw JSON only.`;

      const plan = await llmClient.generateReconPlan(prompt);
      if (plan && plan.phases) {
        testPlan = {
          overview: plan.overview || testPlan.overview,
          authDetected: pageAnalysis.hasAuth,
          phases: plan.phases,
          riskAreas: plan.riskAreas || testPlan.riskAreas,
        };

        if (Array.isArray(plan.customScenarios)) {
          for (const cs of plan.customScenarios) {
            templateScenarios.push({
              title: cs.title || 'Custom AI Scenario',
              goal: cs.goal || 'Test target feature',
              personaId: cs.personaId || 'gremlin',
              viewport: 'desktop',
              needsAuth: !!cs.needsAuth,
              risk: cs.risk === 'high' ? 'high' : cs.risk === 'medium' ? 'medium' : 'low',
              maxSteps: cs.maxSteps || 6,
              expect: Array.isArray(cs.expect) ? cs.expect : ['Tidak ada error konsol', 'Halaman merespons stabil'],
              source: 'ai',
              enabled: cs.risk !== 'high',
              status: 'pending',
            });
          }
        }
      }
    } catch (err) {
      console.warn('[Recon] Muse Spark augmentation skipped, using structured template scenarios:', err);
    }
  }

  // Convert to full Scenario records and store in database
  const finalScenarios: Scenario[] = templateScenarios.map((ts, idx) => ({
    id: crypto.randomUUID(),
    runId,
    idx,
    title: ts.title,
    goal: ts.goal,
    personaId: ts.personaId || 'gremlin',
    viewport: ts.viewport || 'desktop',
    needsAuth: ts.authMode === 'requires' || !!ts.needsAuth,
    authMode: ts.authMode || (ts.needsAuth ? 'requires' : 'none'),
    risk: ts.risk,
    maxSteps: ts.maxSteps,
    expect: ts.expect,
    source: ts.source,
    enabled: ts.enabled,
    status: 'pending',
    verdict: null,
    createdAt: new Date().toISOString(),
  }));

  const createdScenarios = scenariosRepo.bulkCreate(finalScenarios);
  testPlan.scenarios = createdScenarios;

  return {
    testPlan,
    scenarios: createdScenarios,
  };
}

/**
 * Natural language scenario parser for user manual prompt:
 * "Coba bayar dengan keranjang kosong" -> structured Scenario object
 */
export async function parseScenarioFromPrompt(
  promptText: string,
  runId: string,
  existingIndex: number
): Promise<Scenario> {
  const trimmed = promptText.trim();
  const lower = trimmed.toLowerCase();

  const isHighRisk =
    lower.includes('bayar') ||
    lower.includes('pay') ||
    lower.includes('hapus') ||
    lower.includes('delete') ||
    lower.includes('reset');

  const needsAuth =
    lower.includes('login') ||
    lower.includes('admin') ||
    lower.includes('akun') ||
    lower.includes('profil') ||
    lower.includes('logout');

  let personaId = 'gremlin';
  if (lower.includes('cepat') || lower.includes('double') || lower.includes('spam')) {
    personaId = 'speed_demon';
  } else if (lower.includes('kupon') || lower.includes('diskon') || lower.includes('kosong') || lower.includes('negatif')) {
    personaId = 'skeptic';
  } else if (lower.includes('keyboard') || lower.includes('tab') || lower.includes('aksesibilitas')) {
    personaId = 'keyboard_navigator';
  } else if (lower.includes('shop') || lower.includes('beli') || lower.includes('belanja')) {
    personaId = 'shopper';
  }

  const isTestingLoginForm =
    (lower.includes('login') || lower.includes('masuk')) &&
    (lower.includes('salah') || lower.includes('invalid') || lower.includes('fuzz') || lower.includes('leak') || lower.includes('enumerasi'));

  const authMode = isTestingLoginForm ? 'tests_login' : needsAuth ? 'requires' : 'none';

  let parsed = {
    title: trimmed.length > 50 ? `${trimmed.slice(0, 47)}...` : trimmed,
    goal: trimmed,
    personaId,
    risk: isHighRisk ? ('high' as const) : ('low' as const),
    maxSteps: 8,
    expect: [
      'Alur pengujian merespons dengan benar',
      'Tidak terjadi error 500 pada server',
      'Tidak ada unhandled exception di browser',
    ],
    needsAuth,
  };

  if (llmClient.hasLLMConfigured()) {
    try {
      const llmPrompt = `Convert this QA test request into a structured scenario JSON:
Request: "${trimmed}"
Return JSON only:
{
  "title": "Short title (under 50 chars)",
  "goal": "Actionable goal description",
  "personaId": "gremlin" | "skeptic" | "speed-demon" | "pixel-perfectionist",
  "risk": "low" | "medium" | "high",
  "maxSteps": 8,
  "expect": ["Criteria 1", "Criteria 2"],
  "needsAuth": false
}`;
      const result = await llmClient.generateReconPlan(llmPrompt);
      if (result && result.title && result.goal) {
        parsed = {
          title: result.title,
          goal: result.goal,
          personaId: result.personaId || personaId,
          risk: result.risk === 'high' ? 'high' : result.risk === 'medium' ? 'medium' : 'low',
          maxSteps: result.maxSteps || 8,
          expect: Array.isArray(result.expect) && result.expect.length > 0 ? result.expect : parsed.expect,
          needsAuth: Boolean(result.needsAuth),
        };
      }
    } catch {}
  }

  const newScenario: Scenario = {
    id: crypto.randomUUID(),
    runId,
    idx: existingIndex,
    title: parsed.title,
    goal: parsed.goal,
    personaId: parsed.personaId,
    viewport: 'desktop',
    needsAuth: parsed.needsAuth,
    authMode: authMode,
    risk: parsed.risk,
    maxSteps: parsed.maxSteps,
    expect: parsed.expect,
    source: 'user',
    enabled: parsed.risk !== 'high',
    status: 'pending',
    verdict: null,
    createdAt: new Date().toISOString(),
  };

  return scenariosRepo.create(newScenario);
}
