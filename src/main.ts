import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { HabitQuestScene } from './scenes/HabitQuestScene';
import { DashboardScene } from './scenes/DashboardScene';
import { ManageHabitsScene } from './scenes/ManageHabitsScene';
import {
  auth,
  enableLocalDemoData,
  LOCAL_DEMO_USER_ID,
  useLocalDemoData,
} from './firebase/config';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { getOrCreatePlayer } from './services/PlayerService';
import { getHabits } from './services/HabitService';

// ---------------------------------------------------------------------------
// Phaser game configuration
// ---------------------------------------------------------------------------
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 480,
  height: 640,
  backgroundColor: '#0d0d1a',
  parent: 'game-container',
  scene: [
    BootScene,
    PreloadScene,
    MainMenuScene,
    HabitQuestScene,
    DashboardScene,
    ManageHabitsScene,
  ],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

async function loadPlayerData(
  userId: string,
  displayName: string,
  fallbackToDemo = true
): Promise<void> {
  try {
    const [player, habits] = await Promise.all([
      getOrCreatePlayer(userId, displayName),
      getHabits(userId),
    ]);

    game.registry.set('player', player);
    game.registry.set('habits', habits);
    game.events.emit('habitquest:data-ready');
  } catch (err) {
    console.error('Failed to load player data:', err);
    if (fallbackToDemo && !useLocalDemoData()) {
      enableLocalDemoData();
      await loadPlayerData(LOCAL_DEMO_USER_ID, 'Adventurer', false);
      return;
    }
    game.events.emit('habitquest:data-error', err);
  }
}

// ---------------------------------------------------------------------------
// Firebase auth bootstrap
// ---------------------------------------------------------------------------
// On auth state change: load (or create) the player doc and their habits,
// then push both into the Phaser registry so all scenes can access them.
if (useLocalDemoData()) {
  void loadPlayerData(LOCAL_DEMO_USER_ID, 'Adventurer');
} else {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      // Anonymous auth for the vertical-slice demo.
      // Replace with Google/email sign-in once full auth is wired in.
      try {
        await signInAnonymously(auth);
      } catch (err) {
        console.error('Failed to sign in anonymously:', err);
        enableLocalDemoData();
        await loadPlayerData(LOCAL_DEMO_USER_ID, 'Adventurer', false);
      }
      return;
    }

    await loadPlayerData(user.uid, user.displayName ?? 'Adventurer');
  });
}
