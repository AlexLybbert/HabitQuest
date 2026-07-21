/**
 * XP and leveling calculations for Habit Quest.
 *
 * Level thresholds use quadratic scaling so higher levels require
 * progressively more effort:  XP_for_level(n) = floor(100 * n^1.5)
 *
 * Streak multipliers reward consistency:
 *   streak ≥ 30d → ×3.0
 *   streak ≥  7d → ×2.0
 *   streak ≥  3d → ×1.5
 *   otherwise    → ×1.0
 */

/** XP required to advance FROM `level` to `level + 1` */
export function xpRequiredForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

/** Returns the streak-based multiplier */
export function streakMultiplier(streak: number): number {
  if (streak >= 30) return 3.0;
  if (streak >= 7) return 2.0;
  if (streak >= 3) return 1.5;
  return 1.0;
}

/** Final XP earned for one habit completion */
export function calculateXPGain(baseXP: number, streak: number): number {
  return Math.floor(baseXP * streakMultiplier(streak));
}

export interface LevelInfo {
  level: number;
  currentXP: number;
  xpToNextLevel: number;
  /** Progress 0–1 within the current level */
  progress: number;
}

/**
 * Derives the player's level state from cumulative `totalXP`.
 * Returns level, XP within that level, and XP needed to level up.
 */
export function levelFromTotalXP(totalXP: number): LevelInfo {
  let level = 1;
  let remaining = totalXP;

  while (remaining >= xpRequiredForLevel(level)) {
    remaining -= xpRequiredForLevel(level);
    level++;
  }

  const xpToNextLevel = xpRequiredForLevel(level);
  return {
    level,
    currentXP: remaining,
    xpToNextLevel,
    progress: remaining / xpToNextLevel,
  };
}

/** Human-readable label for a streak multiplier */
export function multiplierLabel(streak: number): string {
  const m = streakMultiplier(streak);
  return m === 1.0 ? '' : `×${m.toFixed(1)}`;
}
