import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db, useLocalDemoData } from '../firebase/config';
import type { Habit, HabitDifficulty, HabitFrequency } from '../models/Habit';
import { BASE_XP, completedForCurrentPeriod } from '../models/Habit';

const HABITS_COLLECTION = 'habits';
const LOCAL_HABITS_KEY = 'habitquest:habits';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch all habits belonging to `userId` */
export async function getHabits(userId: string): Promise<Habit[]> {
  if (useLocalDemoData()) {
    return readLocalHabits()
      .filter((habit) => habit.userId === userId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  const q = query(
    collection(db, HABITS_COLLECTION),
    where('userId', '==', userId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Habit));
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface CreateHabitInput {
  userId: string;
  name: string;
  description: string;
  frequency: HabitFrequency;
  difficulty: HabitDifficulty;
}

/** Add a new habit document and return its Firestore id */
export async function createHabit(input: CreateHabitInput): Promise<string> {
  if (useLocalDemoData()) {
    const habitId = crypto.randomUUID();
    const habits = readLocalHabits();
    habits.push({
      id: habitId,
      userId: input.userId,
      name: input.name,
      description: input.description,
      frequency: input.frequency,
      difficulty: input.difficulty,
      currentStreak: 0,
      longestStreak: 0,
      lastCompletedAt: null,
      totalCompletions: 0,
      baseXP: BASE_XP[input.difficulty],
      createdAt: Date.now(),
    });
    writeLocalHabits(habits);
    return habitId;
  }

  const ref = await addDoc(collection(db, HABITS_COLLECTION), {
    userId: input.userId,
    name: input.name,
    description: input.description,
    frequency: input.frequency,
    difficulty: input.difficulty,
    currentStreak: 0,
    longestStreak: 0,
    lastCompletedAt: null,
    totalCompletions: 0,
    baseXP: BASE_XP[input.difficulty],
    createdAt: Date.now(),
  });
  return ref.id;
}

/** Update a habit's mutable fields */
export async function updateHabit(
  habitId: string,
  fields: Partial<Pick<Habit, 'name' | 'description' | 'frequency' | 'difficulty'>>
): Promise<void> {
  const updates: Record<string, unknown> = { ...fields };
  if (fields.difficulty) {
    updates.baseXP = BASE_XP[fields.difficulty];
  }

  if (useLocalDemoData()) {
    const habits = readLocalHabits().map((habit) => {
      if (habit.id !== habitId) return habit;
      return { ...habit, ...updates } as Habit;
    });
    writeLocalHabits(habits);
    return;
  }

  await updateDoc(doc(db, HABITS_COLLECTION, habitId), updates);
}

/** Permanently delete a habit */
export async function deleteHabit(habitId: string): Promise<void> {
  if (useLocalDemoData()) {
    writeLocalHabits(readLocalHabits().filter((habit) => habit.id !== habitId));
    return;
  }

  await deleteDoc(doc(db, HABITS_COLLECTION, habitId));
}

// ---------------------------------------------------------------------------
// Completion logic
// ---------------------------------------------------------------------------

export interface CompleteHabitResult {
  xpEarned: number;
  newStreak: number;
  alreadyCompleted: boolean;
}

/**
 * Mark a habit as completed for today.
 * - Increments streak if the previous matching period was completed.
 * - Returns the XP earned (caller applies it to the player document).
 * Returns `alreadyCompleted: true` without writing if already done this period.
 */
export async function completeHabit(habit: Habit): Promise<CompleteHabitResult> {
  if (completedForCurrentPeriod(habit)) {
    return { xpEarned: 0, newStreak: habit.currentStreak, alreadyCompleted: true };
  }

  const now = Date.now();
  const newStreak = completedPreviousPeriod(habit) ? habit.currentStreak + 1 : 1;
  const longestStreak = Math.max(newStreak, habit.longestStreak);

  if (useLocalDemoData()) {
    const habits = readLocalHabits().map((localHabit) => {
      if (localHabit.id !== habit.id) return localHabit;
      return {
        ...localHabit,
        currentStreak: newStreak,
        longestStreak,
        lastCompletedAt: now,
        totalCompletions: localHabit.totalCompletions + 1,
      };
    });
    writeLocalHabits(habits);
    return { xpEarned: habit.baseXP, newStreak, alreadyCompleted: false };
  }

  await updateDoc(doc(db, HABITS_COLLECTION, habit.id), {
    currentStreak: newStreak,
    longestStreak,
    lastCompletedAt: now,
    totalCompletions: habit.totalCompletions + 1,
    updatedAt: serverTimestamp() as unknown as Timestamp,
  });

  return { xpEarned: habit.baseXP, newStreak, alreadyCompleted: false };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns true if the last completion was in the previous daily/weekly period. */
function completedPreviousPeriod(habit: Habit): boolean {
  const ts = habit.lastCompletedAt;
  if (ts === null) return false;
  if (habit.frequency === 'weekly') return wasPreviousUTCWeek(ts);
  return wasYesterdayUTC(ts);
}

function wasYesterdayUTC(ts: number): boolean {
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const last = new Date(ts);
  return (
    last.getUTCFullYear() === yesterday.getUTCFullYear() &&
    last.getUTCMonth() === yesterday.getUTCMonth() &&
    last.getUTCDate() === yesterday.getUTCDate()
  );
}

function wasPreviousUTCWeek(ts: number): boolean {
  const thisWeekStart = startOfUTCWeek(Date.now());
  const previousWeekStart = thisWeekStart - 7 * 24 * 60 * 60 * 1000;
  return startOfUTCWeek(ts) === previousWeekStart;
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

function readLocalHabits(): Habit[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_HABITS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as Habit[];
  } catch {
    return [];
  }
}

function writeLocalHabits(habits: Habit[]): void {
  window.localStorage.setItem(LOCAL_HABITS_KEY, JSON.stringify(habits));
}
