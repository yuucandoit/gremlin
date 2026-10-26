import type { Signal } from '@gremlin/shared';

export function deduplicateSignals(signals: Signal[]): Signal[] {
  const seen = new Set<string>();
  const unique: Signal[] = [];

  for (const s of signals) {
    // Fingerprint based on type and normalized message
    const normMessage = s.message.replace(/https?:\/\/[^\s]+/g, '<URL>').slice(0, 100);
    const key = `${s.type}:${normMessage}`;

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(s);
    }
  }

  return unique;
}
