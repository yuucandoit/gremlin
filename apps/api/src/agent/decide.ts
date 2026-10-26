import type { DecisionResult } from '@gremlin/shared';
import { llmClient, type ObservationData } from '../llm/client';
import { getPersona } from './personas';

export async function decideNextAction(
  obsData: ObservationData
): Promise<DecisionResult> {
  const persona = getPersona(obsData.personaId);
  return await llmClient.decideAction(obsData, persona.systemPrompt);
}
