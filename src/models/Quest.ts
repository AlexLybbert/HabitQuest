import type { HabitDifficulty } from './Habit';

export interface Quest {
  id: string;
  habitId: string;
  habitName: string;
  description: string;
  difficulty: HabitDifficulty;
  baseXP: number;
  /** Streak-based multiplier (e.g. 1.5, 2.0, 3.0) */
  streakMultiplier: number;
  /** Final XP = Math.floor(baseXP * streakMultiplier) */
  finalXP: number;
  currentStreak: number;
  isCompleted: boolean;
  completedAt: number | null;
  /** UTC midnight timestamp for expiry */
  expiresAt: number;
}

/** Returns the UTC midnight timestamp for the end of today */
export function todayMidnightUTC(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}
