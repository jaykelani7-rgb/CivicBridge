import { TERMINAL_CITIZEN_STAGES } from "./citizen";

export function nextCitizenPollDelay(stage: string | undefined, attempt: number, enabled: boolean): number | false {
  if (!enabled || !stage || TERMINAL_CITIZEN_STAGES.has(stage) || attempt >= 8) return false;
  return Math.min(15000, 1000 * 2 ** Math.min(attempt, 4));
}
