import './globals.css';
import Link from 'next/link';
import { Activity, Bug, History, PlusCircle } from 'lucide-react';

export const metadata = {
  title: 'Gremlin - Autonomous AI Chaos & QA Testing Agent',
  description:
    'Self-directed exploratory testing agent hunting uncaught exceptions, dead buttons, and race conditions.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col bg-background text-slate-100">
        <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-40">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5 group">
              <span className="text-2xl transform group-hover:scale-110 transition-transform">
                👾
              </span>
              <div>
                <span className="font-extrabold text-lg tracking-tight text-white group-hover:text-gremlin-400 transition">
                  GREMLIN
                </span>
                <span className="ml-2 text-[10px] font-mono uppercase px-1.5 py-0.5 rounded bg-gremlin-500/20 text-gremlin-400 border border-gremlin-500/30 font-bold">
                  AI QA AGENT
                </span>
              </div>
            </Link>

            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-800 transition"
              >
                <PlusCircle className="w-4 h-4 text-gremlin-400" /> Start Run
              </Link>
              <Link
                href="/runs"
                className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-lg hover:bg-slate-800 transition"
              >
                <History className="w-4 h-4 text-sky-400" /> Runs History
              </Link>
              <a
                href="http://localhost:3002"
                target="_blank"
                rel="noreferrer"
                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-800 hover:bg-slate-800 transition"
              >
                <span>🛒 Open Demo App</span>
              </a>
            </nav>
          </div>
        </header>

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        <footer className="border-t border-border py-6 text-center text-xs text-slate-500">
          <p>
            Gremlin Autonomous QA Engine • Powered by Bun 1.4, Elysia, Playwright & Next.js
          </p>
        </footer>
      </body>
    </html>
  );
}
