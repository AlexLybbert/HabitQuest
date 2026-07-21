import Phaser from 'phaser';

/**
 * BootScene — first scene to run.
 * Loads only the assets needed by PreloadScene itself (e.g. a loading bar sprite),
 * then immediately transitions to PreloadScene.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Nothing heavy here — just enough for the loading screen.
  }

  create(): void {
    this.scene.start('PreloadScene');
  }
}
