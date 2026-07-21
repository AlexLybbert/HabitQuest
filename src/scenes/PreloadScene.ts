import Phaser from 'phaser';

/**
 * PreloadScene — loads all game assets while displaying a progress bar.
 * Once loading is complete it transitions to MainMenuScene.
 */
export class PreloadScene extends Phaser.Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressBox!: Phaser.GameObjects.Graphics;
  private loadingText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'PreloadScene' });
  }

  preload(): void {
    this.createLoadingUI();

    this.load.on('progress', (value: number) => {
      this.progressBar.clear();
      this.progressBar.fillStyle(0x7c3aed, 1);
      this.progressBar.fillRect(
        this.cameras.main.width / 2 - 150 + 5,
        this.cameras.main.height / 2 - 15,
        (300 - 10) * value,
        20
      );
    });

    this.load.on('complete', () => {
      this.progressBar.destroy();
      this.progressBox.destroy();
      this.loadingText.destroy();
    });

    // -----------------------------------------------------------------------
    // Assets — placeholder coloured rectangles generated at runtime so the
    // game is runnable before real art is available. Replace these with
    // actual sprite sheet / atlas loads once assets are ready.
    // -----------------------------------------------------------------------
    this.createPlaceholderTextures();
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private createLoadingUI(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    this.progressBox = this.add.graphics();
    this.progressBox.fillStyle(0x1e1b4b, 0.9);
    this.progressBox.fillRect(cx - 155, cy - 20, 310, 40);

    this.progressBar = this.add.graphics();

    this.loadingText = this.add
      .text(cx, cy - 40, 'Loading Habit Quest…', {
        fontSize: '18px',
        color: '#c4b5fd',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);
  }

  /** Generate simple coloured rectangle textures so scenes render without real art. */
  private createPlaceholderTextures(): void {
    const textures: Array<{ key: string; color: number; w: number; h: number }> = [
      { key: 'quest-card-bg',   color: 0x1e1b4b, w: 340, h: 90 },
      { key: 'quest-card-done', color: 0x14532d, w: 340, h: 90 },
      { key: 'btn-primary',     color: 0x7c3aed, w: 200, h: 48 },
      { key: 'btn-danger',      color: 0x9f1239, w: 200, h: 48 },
      { key: 'xp-orb',          color: 0xfbbf24, w: 24,  h: 24 },
      { key: 'star',            color: 0xfde68a, w: 20,  h: 20 },
      { key: 'avatar-bg',       color: 0x312e81, w: 64,  h: 64 },
    ];

    for (const t of textures) {
      if (!this.textures.exists(t.key)) {
        const g = this.make.graphics({ x: 0, y: 0 });
        g.fillStyle(t.color, 1);
        g.fillRoundedRect(0, 0, t.w, t.h, 8);
        g.generateTexture(t.key, t.w, t.h);
        g.destroy();
      }
    }
  }
}
