import Phaser from 'phaser';
import type { Player } from '../models/Player';
import type { Habit } from '../models/Habit';
import { levelFromTotalXP } from '../services/XPService';

/**
 * DashboardScene — read-only stats overview.
 *
 * Displays:
 *  - Level, total XP, quests completed
 *  - Per-habit streak and completion history (horizontal bar chart)
 */
export class DashboardScene extends Phaser.Scene {
  private player!: Player;
  private habits!: Habit[];

  constructor() {
    super({ key: 'DashboardScene' });
  }

  init(): void {
    this.player = this.registry.get('player') as Player ?? this.defaultPlayer();
    this.habits = (this.registry.get('habits') as Habit[]) ?? [];
  }

  create(): void {
    const { width } = this.cameras.main;
    const cx = width / 2;

    this.add.rectangle(0, 0, width, this.cameras.main.height, 0x0d0d1a).setOrigin(0);

    // Title
    this.add
      .text(cx, 36, '📊 Dashboard', {
        fontSize: '24px',
        color: '#c4b5fd',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.createBackButton();

    // Player stats block
    this.drawPlayerStats(cx, 100);

    // Habit streak chart
    this.drawStreakChart(cx, 240);
  }

  // ---------------------------------------------------------------------------
  // Sections
  // ---------------------------------------------------------------------------

  private drawPlayerStats(cx: number, y: number): void {
    const { level, currentXP, xpToNextLevel, progress } = levelFromTotalXP(this.player.totalXP);

    const statItems = [
      { label: 'Level', value: `${level}` },
      { label: 'Total XP', value: `${this.player.totalXP.toLocaleString()}` },
      { label: 'Quests Completed', value: `${this.player.questsCompleted}` },
      { label: 'XP to Next Level', value: `${xpToNextLevel - currentXP}` },
    ];

    // Card
    const cardW = 360;
    const cardH = 90;
    const card = this.add.graphics();
    card.fillStyle(0x1e1b4b, 0.95);
    card.fillRoundedRect(cx - cardW / 2, y - 10, cardW, cardH, 10);

    statItems.forEach((s, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      const sx = cx - 150 + col * 180;
      const sy = y + row * 32;

      this.add
        .text(sx, sy, s.label, { fontSize: '10px', color: '#6b7280', fontFamily: 'monospace' })
        .setOrigin(0, 0.5);
      this.add
        .text(sx, sy + 14, s.value, { fontSize: '14px', color: '#e5e7eb', fontFamily: 'monospace', fontStyle: 'bold' })
        .setOrigin(0, 0.5);
    });

    // XP progress bar inline
    const barX = cx - 150;
    const barY = y + cardH - 20;
    const barW = 300;
    this.add.graphics().fillStyle(0x374151, 1).fillRoundedRect(barX, barY, barW, 8, 4);
    this.add.graphics().fillStyle(0x7c3aed, 1).fillRoundedRect(barX, barY, barW * progress, 8, 4);
  }

  private drawStreakChart(cx: number, startY: number): void {
    const headerY = startY;
    this.add
      .text(cx - 160, headerY, 'HABIT STREAKS', {
        fontSize: '11px',
        color: '#6b7280',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    if (this.habits.length === 0) {
      this.add
        .text(cx, startY + 40, 'No habits tracked yet.', {
          fontSize: '14px',
          color: '#4b5563',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5);
      return;
    }

    const maxStreak = Math.max(...this.habits.map((h) => h.longestStreak), 1);
    const barMaxW = 200;
    const rowH = 36;

    this.habits.forEach((habit, i) => {
      const ry = startY + 20 + i * rowH;
      const fillW = Math.max((habit.currentStreak / maxStreak) * barMaxW, 2);

      // Label
      const name = habit.name.length > 18 ? habit.name.slice(0, 17) + '…' : habit.name;
      this.add
        .text(cx - 160, ry, name, {
          fontSize: '12px',
          color: '#d1d5db',
          fontFamily: 'monospace',
        })
        .setOrigin(0, 0.5);

      // Bar background
      this.add.graphics().fillStyle(0x1f2937, 1).fillRoundedRect(cx - 20, ry - 8, barMaxW, 16, 4);

      // Bar fill — colour shifts warm → cool with streak length
      const fillColor = habit.currentStreak >= 7 ? 0x22c55e : habit.currentStreak >= 3 ? 0xfbbf24 : 0x7c3aed;
      this.add.graphics().fillStyle(fillColor, 1).fillRoundedRect(cx - 20, ry - 8, fillW, 16, 4);

      // Value label
      this.add
        .text(cx - 20 + barMaxW + 8, ry, `${habit.currentStreak}d`, {
          fontSize: '11px',
          color: '#9ca3af',
          fontFamily: 'monospace',
        })
        .setOrigin(0, 0.5);
    });
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  private createBackButton(): void {
    const back = this.add
      .text(16, 16, '← Back', {
        fontSize: '13px',
        color: '#6b7280',
        fontFamily: 'monospace',
      })
      .setInteractive({ useHandCursor: true });

    back.on('pointerover', () => back.setColor('#c4b5fd'));
    back.on('pointerout', () => back.setColor('#6b7280'));
    back.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  // ---------------------------------------------------------------------------
  // Fallback
  // ---------------------------------------------------------------------------

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
