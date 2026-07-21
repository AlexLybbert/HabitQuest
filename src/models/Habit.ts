export type HabitFrequency = 'daily' | 'weekly';
export type HabitDifficulty = 'easy' | 'medium' | 'hard';

export interface Habit {
  id: string;
  userId: string;
  name: string;
  description: string;
  frequency: HabitFrequency;
  difficulty: HabitDifficulty;
  currentStreak: number;
  longestStreak: number;
  /** Unix timestamp ms — null if never completed */
  lastCompletedAt: number | null;
  totalCompletions: number;
  /** Base XP awarded on completion before streak multiplier */
  baseXP: number;
  createdAt: number;
}

/** XP per completion keyed by difficulty */
export const BASE_XP: Record<HabitDifficulty, number> = {
  easy: 10,
  medium: 25,
  hard: 50,
};

/** Returns true if the habit has already been completed today (UTC day) */
export function completedToday(habit: Habit): boolean {
  if (habit.lastCompletedAt === null) return false;
  const now = new Date();
  const last = new Date(habit.lastCompletedAt);
  return (
    now.getUTCFullYear() === last.getUTCFullYear() &&
    now.getUTCMonth() === last.getUTCMonth() &&
    now.getUTCDate() === last.getUTCDate()
  );
}
