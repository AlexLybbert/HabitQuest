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
import { db } from '../firebase/config';
import type { Habit, HabitDifficulty, HabitFrequency } from '../models/Habit';
import { BASE_XP, completedToday } from '../models/Habit';

const HABITS_COLLECTION = 'habits';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch all habits belonging to `userId` */
export async function getHabits(userId: string): Promise<Habit[]> {
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
  await updateDoc(doc(db, HABITS_COLLECTION, habitId), updates);
}

/** Permanently delete a habit */
export async function deleteHabit(habitId: string): Promise<void> {
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
 * - Increments streak (or resets to 1 if last completion was more than 1 day ago).
 * - Returns the XP earned (caller applies it to the player document).
 * Returns `alreadyCompleted: true` without writing if already done today.
 */
export async function completeHabit(habit: Habit): Promise<CompleteHabitResult> {
  if (completedToday(habit)) {
    return { xpEarned: 0, newStreak: habit.currentStreak, alreadyCompleted: true };
  }

  const now = Date.now();
  const newStreak = wasYesterday(habit.lastCompletedAt) ? habit.currentStreak + 1 : 1;
  const longestStreak = Math.max(newStreak, habit.longestStreak);

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

/** Returns true if `ts` falls within yesterday's UTC day */
function wasYesterday(ts: number | null): boolean {
  if (ts === null) return false;
  const now = new Date();
  const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  const last = new Date(ts);
  return (
    last.getUTCFullYear() === yesterday.getUTCFullYear() &&
    last.getUTCMonth() === yesterday.getUTCMonth() &&
    last.getUTCDate() === yesterday.getUTCDate()
  );
}
