// Scheduler: pick the healthiest account with remaining 5h-window capacity.
// Preference: owner-match > shared-pool. Implemented in P2.
import type { Account } from '../../db/schema.js';

export interface PickInput {
  provider: 'claude' | 'chatgpt';
  ownerUserId: string | null;
  model: string;
}

export async function pickAccount(_input: PickInput): Promise<Account | null> {
  throw new Error('not implemented: pickAccount (P2)');
}
