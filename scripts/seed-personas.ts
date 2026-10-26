import { PERSONAS } from '../apps/api/src/agent/personas';

console.log('🤖 Seeding Gremlin Personas...');
for (const [key, persona] of Object.entries(PERSONAS)) {
  console.log(`  ✓ [${persona.avatar || '👾'}] ${persona.name} (${key}) - Chaos Level: ${persona.chaosLevel}`);
  console.log(`    Tagline: ${persona.tagline}`);
  console.log(`    Actions: ${persona.preferredActions.join(', ')}`);
}
console.log(`\n✅ ${Object.keys(PERSONAS).length} Personas ready for exploration and chaos testing.`);
