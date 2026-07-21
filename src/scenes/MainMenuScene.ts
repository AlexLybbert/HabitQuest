import Phaser from 'phaser';
import type { Player } from '../models/Player';
import { levelFromTotalXP } from '../services/XPService';

/**
 * MainMenuScene — hub screen.
 *
 * Displays:
 *  - Player name, level, and XP progress bar
 *  - Navigation buttons: Play (→ HabitQuestScene), Dashboard (→ DashboardScene)
 *  - A "Manage Habits" button to open the habit editor overlay (future)
 *
 * Receives player data via the scene registry key 'player'.
 */
export class MainMenuScene extends Phaser.Scene {
  private player!: Player;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  init(): void {
    // Retrieve player data placed in registry by the game bootstrap in main.ts
    this.player = this.registry.get('player') as Player ?? this.defaultPlayer();
  }

  create(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;

    this.add.rectangle(0, 0, width, height, 0x0d0d1a).setOrigin(0);

    // Title
    this.add
      .text(cx, 60, '⚔ HABIT QUEST', {
        fontSize: '36px',
        color: '#c4b5fd',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 100, 'Turn your habits into adventures', {
        fontSize: '14px',
        color: '#6b7280',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    // Player card
    this.drawPlayerCard(cx, 190);

    // Buttons
    this.createButton(cx, 320, 'PLAY DAILY QUESTS', 0x7c3aed, () => {
      this.scene.start('HabitQuestScene');
    });

    this.createButton(cx, 385, 'DASHBOARD', 0x1d4ed8, () => {
      this.scene.start('DashboardScene');
    });

    this.createButton(cx, 450, 'MANAGE HABITS', 0x065f46, () => {
      // Placeholder — habit management UI to be wired in Week 1 Day 2–3
      this.showToast('Habit editor coming soon!');
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private drawPlayerCard(cx: number, cy: number): void {
    const { level, currentXP, xpToNextLevel, progress } = levelFromTotalXP(this.player.totalXP);

    // Card background
    const cardW = 360;
    const cardH = 100;
    const card = this.add.graphics();
    card.fillStyle(0x1e1b4b, 0.95);
    card.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 12);

    // Avatar circle
    this.add.circle(cx - 140, cy, 28, 0x312e81);
    this.add
      .text(cx - 140, cy, this.player.displayName[0]?.toUpperCase() ?? '?', {
        fontSize: '22px',
        color: '#a78bfa',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    // Name & level
    this.add
      .text(cx - 100, cy - 20, this.player.displayName, {
        fontSize: '16px',
        color: '#e5e7eb',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5);

    this.add
      .text(cx - 100, cy + 2, `Level ${level}`, {
        fontSize: '12px',
        color: '#a78bfa',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5);

    // XP bar
    const barX = cx - 100;
    const barY = cy + 24;
    const barW = 200;
    const barH = 10;

    const barBg = this.add.graphics();
    barBg.fillStyle(0x374151, 1);
    barBg.fillRoundedRect(barX, barY, barW, barH, 4);

    const barFill = this.add.graphics();
    barFill.fillStyle(0x7c3aed, 1);
    barFill.fillRoundedRect(barX, barY, barW * progress, barH, 4);

    this.add
      .text(barX + barW + 6, barY + barH / 2, `${currentXP}/${xpToNextLevel} XP`, {
        fontSize: '10px',
        color: '#9ca3af',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5);
  }

  private createButton(
    x: number,
    y: number,
    label: string,
    color: number,
    onClick: () => void
  ): void {
    const btn = this.add.graphics();
    btn.fillStyle(color, 1);
    btn.fillRoundedRect(x - 140, y - 20, 280, 40, 8);
    btn.setInteractive(new Phaser.Geom.Rectangle(x - 140, y - 20, 280, 40), Phaser.Geom.Rectangle.Contains);

    const text = this.add
      .text(x, y, label, {
        fontSize: '14px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    btn.on('pointerover', () => {
      btn.setAlpha(0.85);
      text.setScale(1.04);
    });
    btn.on('pointerout', () => {
      btn.setAlpha(1);
      text.setScale(1);
    });
    btn.on('pointerdown', onClick);
  }

  private showToast(message: string): void {
    const { width, height } = this.cameras.main;
    const toast = this.add
      .text(width / 2, height - 60, message, {
        fontSize: '14px',
        color: '#fbbf24',
        fontFamily: 'monospace',
        backgroundColor: '#1f2937',
        padding: { x: 12, y: 8 },
      })
      .setOrigin(0.5)
      .setAlpha(0);

    this.tweens.add({
      targets: toast,
      alpha: { from: 0, to: 1 },
      duration: 200,
      yoyo: true,
      hold: 1500,
      onComplete: () => toast.destroy(),
    });
  }

  private defaultPlayer(): Player {
    return {
      id: 'guest',
      displayName: 'Adventurer',
      level: 1,
      currentXP: 0,
      totalXP: 0,
      questsCompleted: 0,
      badgesEarned: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
  }
}
