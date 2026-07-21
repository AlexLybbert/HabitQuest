import Phaser from 'phaser';
import type { Habit } from '../models/Habit';
import { completedToday } from '../models/Habit';
import type { Player } from '../models/Player';
import type { Quest } from '../models/Quest';
import { todayMidnightUTC } from '../models/Quest';
import { calculateXPGain, streakMultiplier, levelFromTotalXP } from '../services/XPService';
import { completeHabit } from '../services/HabitService';
import { awardXP } from '../services/PlayerService';

/**
 * HabitQuestScene — the core gameplay loop.
 *
 * Each active (non-completed) habit appears as a Quest card.
 * Clicking a card:
 *  1. Marks the habit complete in Firestore
 *  2. Awards XP (with streak multiplier) to the player document
 *  3. Plays a floating XP animation and updates the HUD
 *  4. Triggers a level-up fanfare if the player advanced a level
 */
export class HabitQuestScene extends Phaser.Scene {
  private player!: Player;
  private habits!: Habit[];
  private quests: Quest[] = [];

  private hudXPText!: Phaser.GameObjects.Text;
  private hudLevelText!: Phaser.GameObjects.Text;
  private xpBarFill!: Phaser.GameObjects.Graphics;
  private readonly HUD_BAR_W = 200;

  constructor() {
    super({ key: 'HabitQuestScene' });
  }

  init(): void {
    this.player = this.registry.get('player') as Player ?? this.defaultPlayer();
    this.habits = (this.registry.get('habits') as Habit[]) ?? [];
  }

  create(): void {
    const { width } = this.cameras.main;
    const cx = width / 2;

    this.add.rectangle(0, 0, width, this.cameras.main.height, 0x0d0d1a).setOrigin(0);

    // Header
    this.add
      .text(cx, 36, '⚔ Daily Quests', {
        fontSize: '24px',
        color: '#c4b5fd',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    // Build HUD (XP bar + level)
    this.buildHUD(cx);

    // Back button
    this.createBackButton();

    // Build quest list from habits
    this.quests = this.habitsToQuests(this.habits);
    this.renderQuestList();
  }

  // ---------------------------------------------------------------------------
  // Quest rendering
  // ---------------------------------------------------------------------------

  private habitsToQuests(habits: Habit[]): Quest[] {
    const expiry = todayMidnightUTC();
    return habits.map((h) => ({
      id: h.id,
      habitId: h.id,
      habitName: h.name,
      description: h.description,
      difficulty: h.difficulty,
      baseXP: h.baseXP,
      streakMultiplier: streakMultiplier(h.currentStreak),
      finalXP: calculateXPGain(h.baseXP, h.currentStreak),
      currentStreak: h.currentStreak,
      isCompleted: completedToday(h),
      completedAt: completedToday(h) ? h.lastCompletedAt : null,
      expiresAt: expiry,
    }));
  }

  private renderQuestList(): void {
    const cx = this.cameras.main.width / 2;
    const startY = 120;
    const cardH = 80;
    const gap = 14;

    if (this.quests.length === 0) {
      this.add
        .text(cx, 280, 'No habits yet.\nAdd some from the main menu!', {
          fontSize: '16px',
          color: '#6b7280',
          fontFamily: 'monospace',
          align: 'center',
        })
        .setOrigin(0.5);
      return;
    }

    this.quests.forEach((quest, i) => {
      this.drawQuestCard(quest, cx, startY + i * (cardH + gap));
    });
  }

  private drawQuestCard(quest: Quest, cx: number, cy: number): void {
    const cardW = 360;
    const cardH = 80;
    const done = quest.isCompleted;

    // Background
    const bg = this.add.graphics();
    bg.fillStyle(done ? 0x14532d : 0x1e1b4b, 1);
    bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 10);
    bg.lineStyle(1, done ? 0x22c55e : 0x4c1d95, 0.6);
    bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 10);

    // Habit name
    this.add
      .text(cx - 155, cy - 14, quest.habitName, {
        fontSize: '15px',
        color: done ? '#86efac' : '#e5e7eb',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0, 0.5);

    // Streak badge
    if (quest.currentStreak > 0) {
      this.add
        .text(cx - 155, cy + 10, `🔥 ${quest.currentStreak}-day streak`, {
          fontSize: '11px',
          color: '#fb923c',
          fontFamily: 'monospace',
        })
        .setOrigin(0, 0.5);
    }

    // XP pill
    const multiplierSuffix = quest.streakMultiplier > 1
      ? ` ×${quest.streakMultiplier.toFixed(1)}`
      : '';
    this.add
      .text(cx + 145, cy, `+${quest.finalXP} XP${multiplierSuffix}`, {
        fontSize: '12px',
        color: done ? '#6b7280' : '#fbbf24',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(1, 0.5);

    // Done checkmark or click target
    if (done) {
      this.add
        .text(cx - 155, cy, '✓ Done', {
          fontSize: '12px',
          color: '#4ade80',
          fontFamily: 'monospace',
        })
        .setOrigin(0, 0.5);
    } else {
      // Interactive tap zone
      const hitArea = this.add
        .rectangle(cx, cy, cardW, cardH, 0xffffff, 0)
        .setInteractive({ useHandCursor: true });

      hitArea.on('pointerover', () => bg.setAlpha(0.85));
      hitArea.on('pointerout', () => bg.setAlpha(1));
      hitArea.on('pointerdown', () => this.handleQuestComplete(quest, cx, cy, bg, hitArea));
    }
  }

  // ---------------------------------------------------------------------------
  // Completion handler
  // ---------------------------------------------------------------------------

  private async handleQuestComplete(
    quest: Quest,
    cx: number,
    cy: number,
    cardBg: Phaser.GameObjects.Graphics,
    hitArea: Phaser.GameObjects.Rectangle
  ): Promise<void> {
    // Prevent double-tap
    hitArea.disableInteractive();

    // Find the corresponding habit
    const habit = this.habits.find((h) => h.id === quest.habitId);
    if (!habit) return;

    try {
      const { alreadyCompleted, newStreak } = await completeHabit(habit);
      if (alreadyCompleted) return;

      const { updatedPlayer, xpEarned, didLevelUp } = await awardXP(
        this.player,
        habit.baseXP,
        newStreak
      );

      // Update local state
      this.player = updatedPlayer;
      this.registry.set('player', updatedPlayer);
      quest.isCompleted = true;

      // Visual feedback
      cardBg.clear();
      cardBg.fillStyle(0x14532d, 1);
      cardBg.fillRoundedRect(cx - 180, cy - 40, 360, 80, 10);

      this.floatingXP(cx, cy, xpEarned);
      this.updateHUD();

      if (didLevelUp) {
        this.showLevelUpBanner(updatedPlayer.level);
      }
    } catch (err) {
      console.error('Failed to complete habit:', err);
      hitArea.setInteractive({ useHandCursor: true });
    }
  }

  // ---------------------------------------------------------------------------
  // Animations
  // ---------------------------------------------------------------------------

  private floatingXP(x: number, y: number, xpEarned: number): void {
    const text = this.add
      .text(x, y, `+${xpEarned} XP`, {
        fontSize: '20px',
        color: '#fbbf24',
        fontFamily: 'monospace',
        fontStyle: 'bold',
        stroke: '#000000',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(10);

    this.tweens.add({
      targets: text,
      y: y - 60,
      alpha: { from: 1, to: 0 },
      duration: 900,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    });

    // Shake camera slightly
    this.cameras.main.shake(120, 0.004);
  }

  private showLevelUpBanner(newLevel: number): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;

    const overlay = this.add.rectangle(cx, height / 2, width, 80, 0x7c3aed, 0.9).setDepth(20);

    const text = this.add
      .text(cx, height / 2, `🎉 LEVEL UP!  You are now Level ${newLevel}`, {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5)
      .setDepth(21);

    this.tweens.add({
      targets: [overlay, text],
      alpha: { from: 1, to: 0 },
      delay: 1800,
      duration: 600,
      onComplete: () => {
        overlay.destroy();
        text.destroy();
      },
    });
  }

  // ---------------------------------------------------------------------------
  // HUD
  // ---------------------------------------------------------------------------

  private buildHUD(cx: number): void {
    const { level, currentXP, xpToNextLevel, progress } = levelFromTotalXP(this.player.totalXP);
    const hudY = this.cameras.main.height - 36;

    // Bar background
    const barBg = this.add.graphics().setDepth(5);
    barBg.fillStyle(0x374151, 1);
    barBg.fillRoundedRect(cx - this.HUD_BAR_W / 2, hudY - 8, this.HUD_BAR_W, 14, 6);

    // Bar fill (kept as instance so updateHUD can redraw it)
    this.xpBarFill = this.add.graphics().setDepth(6);
    this.xpBarFill.fillStyle(0x7c3aed, 1);
    this.xpBarFill.fillRoundedRect(
      cx - this.HUD_BAR_W / 2,
      hudY - 8,
      this.HUD_BAR_W * progress,
      14,
      6
    );

    this.hudLevelText = this.add
      .text(cx - this.HUD_BAR_W / 2 - 8, hudY, `Lv ${level}`, {
        fontSize: '12px',
        color: '#a78bfa',
        fontFamily: 'monospace',
      })
      .setOrigin(1, 0.5)
      .setDepth(7);

    this.hudXPText = this.add
      .text(cx + this.HUD_BAR_W / 2 + 8, hudY, `${currentXP}/${xpToNextLevel}`, {
        fontSize: '10px',
        color: '#9ca3af',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5)
      .setDepth(7);
  }

  private updateHUD(): void {
    const { level, currentXP, xpToNextLevel, progress } = levelFromTotalXP(this.player.totalXP);
    const cx = this.cameras.main.width / 2;
    const hudY = this.cameras.main.height - 36;

    this.xpBarFill.clear();
    this.xpBarFill.fillStyle(0x7c3aed, 1);
    this.xpBarFill.fillRoundedRect(
      cx - this.HUD_BAR_W / 2,
      hudY - 8,
      this.HUD_BAR_W * progress,
      14,
      6
    );

    this.hudLevelText.setText(`Lv ${level}`);
    this.hudXPText.setText(`${currentXP}/${xpToNextLevel}`);
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
