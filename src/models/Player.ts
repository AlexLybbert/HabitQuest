export interface Player {
  id: string;
  displayName: string;
  level: number;
  /** XP accumulated within the current level */
  currentXP: number;
  /** All-time XP earned */
  totalXP: number;
  /** Total quests/habits completed */
  questsCompleted: number;
  badgesEarned: string[];
  createdAt: number;
  updatedAt: number;
}

/** Creates a default Player document for a new user */
export function createDefaultPlayer(id: string, displayName: string): Player {
  const now = Date.now();
  return {
    id,
    displayName,
    level: 1,
    currentXP: 0,
    totalXP: 0,
    questsCompleted: 0,
    badgesEarned: [],
    createdAt: now,
    updatedAt: now,
  };
}
