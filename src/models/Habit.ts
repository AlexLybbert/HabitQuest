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

/** Returns true if the habit has already been completed in its active period. */
export function completedForCurrentPeriod(habit: Habit): boolean {
  if (habit.frequency === 'weekly') {
    return completedThisWeek(habit);
  }
  return completedToday(habit);
}

/** Returns true if the habit has already been completed this UTC week. */
export function completedThisWeek(habit: Habit): boolean {
  if (habit.lastCompletedAt === null) return false;

  const nowStart = startOfUTCWeek(Date.now());
  const lastStart = startOfUTCWeek(habit.lastCompletedAt);
  return nowStart === lastStart;
}

/** Returns the UTC timestamp when the habit's current period expires. */
export function currentPeriodEndUTC(habit: Habit): number {
  if (habit.frequency === 'weekly') {
    return startOfUTCWeek(Date.now()) + 7 * 24 * 60 * 60 * 1000;
  }

  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
}

function startOfUTCWeek(ts: number): number {
  const date = new Date(ts);
  const day = date.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() - daysSinceMonday
  );
}
