import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { HabitQuestScene } from './scenes/HabitQuestScene';
import { DashboardScene } from './scenes/DashboardScene';
import { auth } from './firebase/config';
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
  scene: [BootScene, PreloadScene, MainMenuScene, HabitQuestScene, DashboardScene],
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
};

const game = new Phaser.Game(config);

// ---------------------------------------------------------------------------
// Firebase auth bootstrap
// ---------------------------------------------------------------------------
// On auth state change: load (or create) the player doc and their habits,
// then push both into the Phaser registry so all scenes can access them.
onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Anonymous auth for the vertical-slice demo.
    // Replace with Google/email sign-in once full auth is wired in.
    await signInAnonymously(auth);
    return;
  }

  try {
    const [player, habits] = await Promise.all([
      getOrCreatePlayer(user.uid, user.displayName ?? 'Adventurer'),
      getHabits(user.uid),
    ]);

    game.registry.set('player', player);
    game.registry.set('habits', habits);
  } catch (err) {
    console.error('Failed to load player data:', err);
  }
});
