import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { db, useLocalDemoData } from '../firebase/config';
import type { Player } from '../models/Player';
import { createDefaultPlayer } from '../models/Player';
import { calculateXPGain, levelFromTotalXP } from './XPService';

const PLAYERS_COLLECTION = 'players';
const LOCAL_PLAYERS_KEY = 'habitquest:players';

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/** Fetch a player document; returns null if it doesn't exist yet */
export async function getPlayer(userId: string): Promise<Player | null> {
  if (useLocalDemoData()) {
    return readLocalPlayers()[userId] ?? null;
  }

  const snap = await getDoc(doc(db, PLAYERS_COLLECTION, userId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Player;
}

/** Fetch or initialise a player document on first login */
export async function getOrCreatePlayer(userId: string, displayName: string): Promise<Player> {
  const existing = await getPlayer(userId);
  if (existing) return existing;

  const player = createDefaultPlayer(userId, displayName);
  if (useLocalDemoData()) {
    const players = readLocalPlayers();
    players[userId] = player;
    writeLocalPlayers(players);
    return player;
  }

  await setDoc(doc(db, PLAYERS_COLLECTION, userId), player);
  return player;
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

/**
 * Award XP to a player after completing a habit.
 * Recalculates level from updated totalXP and persists the result.
 * Returns the updated Player.
 */
export async function awardXP(
  player: Player,
  baseXP: number,
  streak: number
): Promise<{ updatedPlayer: Player; xpEarned: number; didLevelUp: boolean }> {
  const xpEarned = calculateXPGain(baseXP, streak);
  const newTotalXP = player.totalXP + xpEarned;
  const prevLevel = player.level;

  const { level, currentXP, xpToNextLevel } = levelFromTotalXP(newTotalXP);
  const didLevelUp = level > prevLevel;

  const updatedPlayer: Player = {
    ...player,
    level,
    currentXP,
    totalXP: newTotalXP,
    questsCompleted: player.questsCompleted + 1,
    updatedAt: Date.now(),
  };

  if (useLocalDemoData()) {
    const players = readLocalPlayers();
    players[player.id] = updatedPlayer;
    writeLocalPlayers(players);
    return { updatedPlayer, xpEarned, didLevelUp };
  }

  await updateDoc(doc(db, PLAYERS_COLLECTION, player.id), {
    level,
    currentXP,
    totalXP: newTotalXP,
    questsCompleted: updatedPlayer.questsCompleted,
    updatedAt: updatedPlayer.updatedAt,
  });

  // Suppress unused-variable lint for xpToNextLevel; it's part of the contract.
  void xpToNextLevel;

  return { updatedPlayer, xpEarned, didLevelUp };
}

/** Update the player's display name */
export async function updateDisplayName(userId: string, displayName: string): Promise<void> {
  if (useLocalDemoData()) {
    const players = readLocalPlayers();
    const existing = players[userId];
    if (existing) {
      players[userId] = { ...existing, displayName, updatedAt: Date.now() };
      writeLocalPlayers(players);
    }
    return;
  }

  await updateDoc(doc(db, PLAYERS_COLLECTION, userId), {
    displayName,
    updatedAt: Date.now(),
  });
}

function readLocalPlayers(): Record<string, Player> {
  try {
    const raw = window.localStorage.getItem(LOCAL_PLAYERS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Record<string, Player>;
  } catch {
    return {};
  }
}

function writeLocalPlayers(players: Record<string, Player>): void {
  window.localStorage.setItem(LOCAL_PLAYERS_KEY, JSON.stringify(players));
}
