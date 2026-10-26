# 👾 Gremlin

**Gremlin** is an autonomous AI-powered exploratory and chaos testing agent designed for modern web applications. Powered by **Bun 1.4**, **Elysia.js**, **Playwright**, and **Next.js**, Gremlin observes the page DOM and visual state, reasons about user actions using persona-driven prompts, executes interactions in headless Chromium, and identifies unhandled exceptions, race conditions, dead clicks, and server errors in real time.

---

## 🏗️ Architecture & Monorepo Structure

```
gremlin/
├── package.json                 # Monorepo workspaces & orchestrator scripts
├── bun.lock                     # Lockfile (committed)
├── .env.example                 # Environment variables reference
├── docker-compose.yml           # Containerized multi-service deployment
├── README.md                    # System documentation
├── apps/
│   ├── api/                     # Elysia.js + Bun 1.4 + SQLite Backend
│   │   ├── package.json
│   │   ├── src/
│   │   │   ├── index.ts         # Elysia application entrypoint & plugin wiring
│   │   │   ├── routes/
│   │   │   │   ├── runs.ts      # POST /runs, GET /runs, GET /runs/:id, artifacts
│   │   │   │   ├── events.ts    # GET /runs/:id/events (Server-Sent Events)
│   │   │   │   └── report.ts    # GET /runs/:id/report (synthesized findings)
│   │   │   ├── db/
│   │   │   │   ├── client.ts    # bun:sqlite client with WAL mode
│   │   │   │   ├── schema.sql   # Relational schema (runs, steps, signals, findings)
│   │   │   │   ├── migrate.ts   # Auto-migration runner
│   │   │   │   └── repo/        # runs.ts, steps.ts, signals.ts, findings.ts
│   │   │   ├── agent/
│   │   │   │   ├── loop.ts      # Core autonomous loop (Observe -> Decide -> Act -> Detect)
│   │   │   │   ├── observe.ts   # High-res screenshot, ARIA tree & interactive DOM parsing
│   │   │   │   ├── decide.ts    # Persona prompt formatting & action decision
│   │   │   │   ├── act.ts       # Playwright execution (click, dblclick, type, scroll, wait)
│   │   │   │   ├── guardrails.ts# Step limits, run timeouts, and loop detection
│   │   │   │   ├── personas.ts  # Testing personas (Chaos Gremlin, Shopper, Skeptic, Speed Demon)
│   │   │   │   └── detectors/
│   │   │   │       ├── console.ts   # Uncaught errors, warnings & page errors
│   │   │   │       ├── network.ts   # HTTP 4xx/5xx responses & failed fetches
│   │   │   │       ├── deadClick.ts # Clicks with 0 DOM change, 0 URL change & 0 network calls
│   │   │   │       └── stuck.ts     # Repetitive state traps
│   │   │   ├── report/
│   │   │   │   ├── builder.ts   # Telemetry synthesis into categorized findings
│   │   │   │   ├── dedupe.ts    # Signal deduplication
│   │   │   │   └── exportSpec.ts# Playwright regression test generator
│   │   │   ├── llm/
│   │   │   │   ├── client.ts    # LLM client + autonomous heuristic fallback
│   │   │   │   └── prompts/     # decide.md, report.md
│   │   │   └── lib/
│   │   │       ├── events.ts    # Pub/Sub event bus & SQLite persistence
│   │   │       ├── queue.ts     # In-memory concurrent run queue
│   │   │       └── storage.ts   # Run artifacts management
│   │   └── tests/
│   │       └── compat.test.ts   # API, DB, and compatibility test suite
│   └── web/                     # Next.js 15 Web Application
│       ├── package.json
│       └── src/
│           ├── app/
│           │   ├── page.tsx             # Run configuration & dispatch form
│           │   ├── runs/page.tsx        # Historical exploratory sessions
│           │   └── runs/[id]/page.tsx   # Real-time timeline, telemetry & report viewer
│           ├── components/
│           │   ├── RunForm.tsx          # Presets & persona selector
│           │   ├── StepTimeline.tsx     # Visual step-by-step audit trail
│           │   ├── FindingCard.tsx      # Severity pills, repro steps & fix suggestions
│           │   └── ScreenshotViewer.tsx # Interactive step screenshot inspector
│           └── lib/
│               ├── api.ts              # API client functions
│               └── useRunEvents.ts     # Real-time SSE hook
├── packages/
│   └── shared/                  # Common TypeScript schemas
│       ├── package.json
│       └── src/
│           ├── types.ts         # Run, Step, Signal, Finding, Persona interfaces
│           ├── events.ts        # Server-Sent Event types
│           └── actions.ts       # Agent Action schemas & discriminated unions
├── demo-app/                    # GlitchMart - E-Commerce store with deliberate bugs
│   ├── package.json
│   └── src/
│       └── index.ts             # Double charge, emoji crash, dead click, 500 coupon
├── data/                        # Persistent database and run artifacts (gitignored)
│   ├── gremlin.db
│   └── runs/{run_id}/
│       ├── steps/001.png
│       ├── trace.zip
│       └── regression.spec.ts
└── scripts/
    └── seed-personas.ts         # Persona seeding & configuration inspection
```

---

## ⚡ Quick Start

### 1. Requirements
- **Bun 1.4+** (`bun --version`)
- Headless browser dependencies (installed via `bun node_modules/.bun/playwright@*/node_modules/playwright/cli.js install chromium`)

### 2. Install Dependencies
```bash
bun install
```

### 3. Start Development Services
Run each service in separate terminal windows or background sessions:

```bash
# 1. Start the Demo Store (Port 3002)
bun run dev:demo

# 2. Start the Backend API (Port 3001)
bun run dev:api

# 3. Start the Next.js Frontend (Port 3000)
bun run dev:web
```

Open [http://localhost:3000](http://localhost:3000) to view the Gremlin dashboard.

---

## 🧪 Testing Personas

Gremlin provides 5 purpose-built testing personas:

1. **👾 The Chaos Gremlin** (`chaosLevel: 0.9`): Rapidly interacts with elements, double clicks submit buttons, enters emoji strings and special characters, and searches for unhandled edge states.
2. **🛍️ Happy Path Shopper** (`chaosLevel: 0.1`): Simulates standard customers browsing catalog items, adding products to cart, filling valid details, and walking through checkout.
3. **🧐 Edge Case Skeptic** (`chaosLevel: 0.6`): Enters negative numbers, empty form submissions, special characters, and boundary codes (`DISCOUNT99`).
4. **⚡ Speed Demon** (`chaosLevel: 0.8`): Tests race conditions and duplicate submissions by double-clicking actionable controls before response completion.
5. **⌨️ Keyboard Explorer** (`chaosLevel: 0.3`): Navigates using Tab, Shift-Tab, Enter, and Space to verify keyboard accessibility and focus traps.

---

## 🛒 Deliberate Bugs in `demo-app` (GlitchMart)

The included demo application (`http://localhost:3002`) provides a realistic storefront containing 5 deliberate bugs:

| Bug | Trigger | Detected Anomaly |
|---|---|---|
| **Double-Click Checkout** | Double-clicking "Place Order" button | Race condition resulting in duplicate charge and dual orders |
| **Emoji Client Crash** | Typing emoji (e.g. `👾` or `🛒`) in Name/Address | Uncaught `TypeError` crashing client application JavaScript |
| **Dead Click** | Clicking "Apply Coupon" button | Button has empty event handler: 0 DOM change, 0 URL change, 0 network |
| **HTTP 500 Server Error** | Entering coupon code `DISCOUNT99` | Backend `/api/coupon` throws HTTP 500 NullPointerException |
| **Negative Quantity** | Clicking `-` button on item quantity | Decrements quantity below zero, yielding negative cart totals |

---

## 📡 Telemetry & Server-Sent Events (SSE)

Real-time streaming is powered by Elysia SSE at `GET /runs/:id/events`:
- `run:started`: Session initialized.
- `step:acted`: Step executed with screenshot and agent thought.
- `signal:detected`: Real-time console error, network failure, or dead click.
- `finding:created`: Defect categorized by severity (CRITICAL, HIGH, MEDIUM, LOW).
- `run:completed`: Exploration finished; Playwright regression spec generated.

---

## 📜 Executable Playwright Regression Specs

Every completed run automatically synthesizes an executable Playwright test script saved to:
`data/runs/{run_id}/regression.spec.ts`

You can run the generated regression test directly:
```bash
bunx playwright test data/runs/<RUN_ID>/regression.spec.ts
```

---

## 🧪 Running Tests

To run the automated compatibility and backend test suite:
```bash
bun test
```
