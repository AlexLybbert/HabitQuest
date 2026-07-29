import Phaser from 'phaser';
import { auth, LOCAL_DEMO_USER_ID, useLocalDemoData } from '../firebase/config';
import type { Habit, HabitDifficulty, HabitFrequency } from '../models/Habit';
import {
  createHabit,
  deleteHabit,
  getHabits,
  updateHabit,
} from '../services/HabitService';

const DIFFICULTIES: HabitDifficulty[] = ['easy', 'medium', 'hard'];
const FREQUENCIES: HabitFrequency[] = ['daily', 'weekly'];

interface HabitFormValues {
  name: string;
  description: string;
  frequency: HabitFrequency;
  difficulty: HabitDifficulty;
}

/**
 * ManageHabitsScene - CRUD screen for habit definitions.
 *
 * Phaser is not a great fit for text-entry forms, so this scene uses compact
 * native prompts for data entry while keeping the rest of the flow in-game.
 */
export class ManageHabitsScene extends Phaser.Scene {
  private habits: Habit[] = [];
  private selectedHabitId: string | null = null;
  private page = 0;
  private rowObjects: Phaser.GameObjects.GameObject[] = [];
  private statusText!: Phaser.GameObjects.Text;
  private readonly rowsPerPage = 5;

  constructor() {
    super({ key: 'ManageHabitsScene' });
  }

  init(): void {
    this.habits = (this.registry.get('habits') as Habit[]) ?? [];
    this.selectedHabitId = this.habits[0]?.id ?? null;
    this.page = 0;
  }

  create(): void {
    this.game.events.once('habitquest:data-ready', () => {
      if (this.scene.isActive('ManageHabitsScene')) {
        this.habits = (this.registry.get('habits') as Habit[]) ?? [];
        this.selectedHabitId = this.habits[0]?.id ?? null;
        this.renderList();
        this.setStatus('');
      }
    });

    const { width, height } = this.cameras.main;
    const cx = width / 2;

    this.add.rectangle(0, 0, width, height, 0x0d0d1a).setOrigin(0);
    this.createBackButton();

    this.add
      .text(cx, 36, 'Manage Habits', {
        fontSize: '24px',
        color: '#c4b5fd',
        fontFamily: 'monospace',
        fontStyle: 'bold',
      })
      .setOrigin(0.5);

    this.add
      .text(cx, 66, 'Create habits, set difficulty, and retire old quests.', {
        fontSize: '12px',
        color: '#9ca3af',
        fontFamily: 'monospace',
      })
      .setOrigin(0.5);

    this.createButton(cx - 144, 580, 'ADD', 0x065f46, () => void this.addHabit());
    this.createButton(cx - 48, 580, 'SAMPLE', 0x7c3aed, () => void this.addSampleHabits());
    this.createButton(cx + 48, 580, 'EDIT', 0x1d4ed8, () => void this.editSelectedHabit());
    this.createButton(cx + 144, 580, 'DELETE', 0x9f1239, () => void this.deleteSelectedHabit());

    this.createButton(cx - 62, 530, 'PREV', 0x374151, () => this.changePage(-1));
    this.createButton(cx + 62, 530, 'NEXT', 0x374151, () => this.changePage(1));

    this.statusText = this.add
      .text(cx, 498, '', {
        fontSize: '12px',
        color: '#fbbf24',
        fontFamily: 'monospace',
        align: 'center',
      })
      .setOrigin(0.5);

    this.renderList();
  }

  private renderList(): void {
    this.rowObjects.forEach((obj) => obj.destroy());
    this.rowObjects = [];

    const { width } = this.cameras.main;
    const cx = width / 2;
    const listTop = 108;

    if (this.habits.length === 0) {
      this.rowObjects.push(
        this.add
          .text(cx, 270, 'No habits yet.\nPress ADD to create your first quest.', {
            fontSize: '15px',
            color: '#6b7280',
            fontFamily: 'monospace',
            align: 'center',
          })
          .setOrigin(0.5)
      );
      return;
    }

    const pageCount = Math.ceil(this.habits.length / this.rowsPerPage);
    this.page = Phaser.Math.Clamp(this.page, 0, pageCount - 1);
    const start = this.page * this.rowsPerPage;
    const visibleHabits = this.habits.slice(start, start + this.rowsPerPage);

    visibleHabits.forEach((habit, index) => {
      this.drawHabitRow(habit, cx, listTop + index * 76);
    });

    this.rowObjects.push(
      this.add
        .text(cx, 462, `Page ${this.page + 1} of ${pageCount}`, {
          fontSize: '11px',
          color: '#6b7280',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5)
    );
  }

  private drawHabitRow(habit: Habit, cx: number, cy: number): void {
    const selected = habit.id === this.selectedHabitId;
    const cardW = 380;
    const cardH = 62;
    const group = this.add.container(0, 0);
    this.rowObjects.push(group);

    const bg = this.add.graphics();
    bg.fillStyle(selected ? 0x312e81 : 0x1e1b4b, 0.96);
    bg.fillRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
    bg.lineStyle(1, selected ? 0xa78bfa : 0x4c1d95, selected ? 1 : 0.6);
    bg.strokeRoundedRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
    group.add(bg);

    const hit = this.add
      .rectangle(cx, cy, cardW, cardH, 0xffffff, 0)
      .setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => {
      this.selectedHabitId = habit.id;
      this.renderList();
    });
    group.add(hit);

    const name = habit.name.length > 27 ? `${habit.name.slice(0, 26)}...` : habit.name;
    group.add(
      this.add
        .text(cx - 172, cy - 14, name, {
          fontSize: '14px',
          color: '#e5e7eb',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        })
        .setOrigin(0, 0.5)
    );

    group.add(
      this.add
        .text(cx - 172, cy + 12, this.summaryForHabit(habit), {
          fontSize: '11px',
          color: '#9ca3af',
          fontFamily: 'monospace',
        })
        .setOrigin(0, 0.5)
    );

    const diffColor = this.colorForDifficulty(habit.difficulty);
    const badge = this.add.graphics();
    badge.fillStyle(diffColor, 1);
    badge.fillRoundedRect(cx + 90, cy - 18, 78, 22, 6);
    group.add(badge);
    group.add(
      this.add
        .text(cx + 129, cy - 7, habit.difficulty.toUpperCase(), {
          fontSize: '10px',
          color: '#ffffff',
          fontFamily: 'monospace',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
    );

    group.add(
      this.add
        .text(cx + 129, cy + 17, `+${habit.baseXP} XP`, {
          fontSize: '11px',
          color: '#fbbf24',
          fontFamily: 'monospace',
        })
        .setOrigin(0.5)
    );
  }

  private async addHabit(): Promise<void> {
    const userId = this.activeUserId();
    if (!userId) {
      this.setStatus('Still connecting to Firebase. Try again in a moment.');
      return;
    }

    const values = await this.collectHabitFormValues();
    if (!values) return;

    try {
      this.setStatus('Adding habit...');
      const habitId = await createHabit({ userId, ...values });
      await this.refreshHabits(userId);
      this.selectedHabitId = habitId;
      this.renderList();
      this.setStatus('Habit added.');
    } catch (err) {
      console.error('Failed to add habit:', err);
      this.setStatus('Could not add habit. Check Firebase setup.');
    }
  }

  private async editSelectedHabit(): Promise<void> {
    const habit = this.selectedHabit();
    if (!habit) {
      this.setStatus('Select a habit first.');
      return;
    }

    const values = await this.collectHabitFormValues(habit);
    if (!values) return;

    try {
      this.setStatus('Saving changes...');
      await updateHabit(habit.id, values);
      await this.refreshHabits(habit.userId);
      this.selectedHabitId = habit.id;
      this.renderList();
      this.setStatus('Habit updated.');
    } catch (err) {
      console.error('Failed to update habit:', err);
      this.setStatus('Could not update habit.');
    }
  }

  private async addSampleHabits(): Promise<void> {
    const userId = this.activeUserId();
    if (!userId) {
      this.setStatus('Still connecting. Try again in a moment.');
      return;
    }

    const samples: HabitFormValues[] = [
      {
        name: 'Drink water',
        description: 'Hydrate before the day gets busy.',
        frequency: 'daily',
        difficulty: 'easy',
      },
      {
        name: 'Study for 25 minutes',
        description: 'One focused Pomodoro for class work.',
        frequency: 'daily',
        difficulty: 'medium',
      },
      {
        name: 'Weekly planning review',
        description: 'Review assignments and plan the week.',
        frequency: 'weekly',
        difficulty: 'hard',
      },
    ];

    try {
      this.setStatus('Adding sample habits...');
      const existingNames = new Set(this.habits.map((habit) => habit.name.toLowerCase()));
      for (const sample of samples) {
        if (!existingNames.has(sample.name.toLowerCase())) {
          await createHabit({ userId, ...sample });
        }
      }

      await this.refreshHabits(userId);
      this.selectedHabitId = this.habits[0]?.id ?? null;
      this.renderList();
      this.setStatus('Sample habits ready. Press Back, then Play.');
    } catch (err) {
      console.error('Failed to add sample habits:', err);
      this.setStatus('Could not add samples.');
    }
  }

  private async deleteSelectedHabit(): Promise<void> {
    const habit = this.selectedHabit();
    if (!habit) {
      this.setStatus('Select a habit first.');
      return;
    }

    const confirmed = window.confirm(`Delete "${habit.name}"? This cannot be undone.`);
    if (!confirmed) return;

    try {
      this.setStatus('Deleting habit...');
      await deleteHabit(habit.id);
      await this.refreshHabits(habit.userId);
      this.selectedHabitId = this.habits[0]?.id ?? null;
      this.renderList();
      this.setStatus('Habit deleted.');
    } catch (err) {
      console.error('Failed to delete habit:', err);
      this.setStatus('Could not delete habit.');
    }
  }

  private async refreshHabits(userId: string): Promise<void> {
    this.habits = await getHabits(userId);
    this.registry.set('habits', this.habits);
    this.game.events.emit('habitquest:habits-updated', this.habits);
  }

  private collectHabitFormValues(existing?: Habit): Promise<HabitFormValues | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-modal', 'true');
      this.applyStyles(overlay, {
        position: 'fixed',
        inset: '0',
        zIndex: '1000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(13, 13, 26, 0.82)',
        fontFamily: 'monospace',
      });

      const form = document.createElement('form');
      this.applyStyles(form, {
        width: 'min(360px, calc(100vw - 32px))',
        background: '#1e1b4b',
        border: '1px solid #6d28d9',
        borderRadius: '8px',
        boxSizing: 'border-box',
        padding: '18px',
        color: '#e5e7eb',
        boxShadow: '0 18px 50px rgba(0, 0, 0, 0.45)',
      });

      const title = document.createElement('h2');
      title.textContent = existing ? 'Edit Habit' : 'Add Habit';
      this.applyStyles(title, {
        margin: '0 0 14px',
        fontSize: '18px',
        color: '#c4b5fd',
      });

      const nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.maxLength = 60;
      nameInput.required = true;
      nameInput.value = existing?.name ?? '';

      const descriptionInput = document.createElement('textarea');
      descriptionInput.maxLength = 140;
      descriptionInput.rows = 3;
      descriptionInput.value = existing?.description ?? '';
      this.applyStyles(descriptionInput, {
        resize: 'vertical',
        minHeight: '70px',
      });

      const frequencySelect = document.createElement('select');
      this.addOption(frequencySelect, 'daily', 'Daily');
      this.addOption(frequencySelect, 'weekly', 'Weekly');
      frequencySelect.value = existing?.frequency ?? 'daily';

      const difficultySelect = document.createElement('select');
      this.addOption(difficultySelect, 'easy', 'Easy - 10 XP');
      this.addOption(difficultySelect, 'medium', 'Medium - 25 XP');
      this.addOption(difficultySelect, 'hard', 'Hard - 50 XP');
      difficultySelect.value = existing?.difficulty ?? 'easy';

      const error = document.createElement('div');
      this.applyStyles(error, {
        minHeight: '18px',
        marginTop: '8px',
        color: '#fbbf24',
        fontSize: '12px',
      });

      form.append(
        title,
        this.field('Name', nameInput),
        this.field('Description', descriptionInput),
        this.field('Frequency', frequencySelect),
        this.field('Difficulty', difficultySelect),
        error,
        this.formActions(resolve, overlay)
      );

      form.addEventListener('submit', (event) => {
        event.preventDefault();
        const cleanName = nameInput.value.trim();
        if (cleanName.length === 0) {
          error.textContent = 'Habit name is required.';
          nameInput.focus();
          return;
        }

        overlay.remove();
        resolve({
          name: cleanName.slice(0, 60),
          description: descriptionInput.value.trim().slice(0, 140),
          frequency: frequencySelect.value as HabitFrequency,
          difficulty: difficultySelect.value as HabitDifficulty,
        });
      });

      overlay.addEventListener('pointerdown', (event) => event.stopPropagation());
      overlay.appendChild(form);
      document.body.appendChild(overlay);
      nameInput.focus();
      nameInput.select();
    });
  }

  private field(labelText: string, control: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): HTMLElement {
    const label = document.createElement('label');
    this.applyStyles(label, {
      display: 'block',
      marginBottom: '10px',
      color: '#9ca3af',
      fontSize: '12px',
    });

    const labelSpan = document.createElement('span');
    labelSpan.textContent = labelText;
    this.applyStyles(labelSpan, {
      display: 'block',
      marginBottom: '5px',
    });

    this.applyStyles(control, {
      width: '100%',
      boxSizing: 'border-box',
      border: '1px solid #4c1d95',
      borderRadius: '6px',
      background: '#111827',
      color: '#f9fafb',
      fontFamily: 'monospace',
      fontSize: '14px',
      outline: 'none',
      padding: '9px 10px',
    });

    label.append(labelSpan, control);
    return label;
  }

  private formActions(
    resolve: (value: HabitFormValues | null) => void,
    overlay: HTMLElement
  ): HTMLElement {
    const actions = document.createElement('div');
    this.applyStyles(actions, {
      display: 'flex',
      gap: '10px',
      justifyContent: 'flex-end',
      marginTop: '8px',
    });

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    this.applyButtonStyles(cancel, '#374151');
    cancel.addEventListener('click', () => {
      overlay.remove();
      resolve(null);
    });

    const save = document.createElement('button');
    save.type = 'submit';
    save.textContent = 'Save';
    this.applyButtonStyles(save, '#065f46');

    actions.append(cancel, save);
    return actions;
  }

  private addOption(select: HTMLSelectElement, value: string, label: string): void {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    select.appendChild(option);
  }

  private applyButtonStyles(button: HTMLButtonElement, background: string): void {
    this.applyStyles(button, {
      border: '0',
      borderRadius: '6px',
      background,
      color: '#ffffff',
      cursor: 'pointer',
      fontFamily: 'monospace',
      fontSize: '13px',
      fontWeight: '700',
      padding: '9px 14px',
    });
  }

  private applyStyles(element: HTMLElement, styles: Partial<CSSStyleDeclaration>): void {
    Object.assign(element.style, styles);
  }

  private selectedHabit(): Habit | null {
    if (!this.selectedHabitId) return null;
    return this.habits.find((habit) => habit.id === this.selectedHabitId) ?? null;
  }

  private changePage(delta: number): void {
    const pageCount = Math.max(Math.ceil(this.habits.length / this.rowsPerPage), 1);
    this.page = Phaser.Math.Clamp(this.page + delta, 0, pageCount - 1);
    this.renderList();
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
    btn.fillRoundedRect(x - 44, y - 18, 88, 36, 8);
    btn.setInteractive(
      new Phaser.Geom.Rectangle(x - 44, y - 18, 88, 36),
      Phaser.Geom.Rectangle.Contains
    );

    const text = this.add
      .text(x, y, label, {
        fontSize: '12px',
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

  private createBackButton(): void {
    const back = this.add
      .text(16, 16, '< Back', {
        fontSize: '13px',
        color: '#6b7280',
        fontFamily: 'monospace',
      })
      .setInteractive({ useHandCursor: true });

    back.on('pointerover', () => back.setColor('#c4b5fd'));
    back.on('pointerout', () => back.setColor('#6b7280'));
    back.on('pointerdown', () => this.scene.start('MainMenuScene'));
  }

  private setStatus(message: string): void {
    if (this.statusText) {
      this.statusText.setText(message);
    }
  }

  private summaryForHabit(habit: Habit): string {
    const completionLabel = `${habit.totalCompletions} done`;
    const streakLabel = `${habit.currentStreak}d streak`;
    return `${habit.frequency} - ${streakLabel} - ${completionLabel}`;
  }

  private parseFrequency(value: string): HabitFrequency | null {
    const normalized = value.trim().toLowerCase();
    return FREQUENCIES.includes(normalized as HabitFrequency)
      ? (normalized as HabitFrequency)
      : null;
  }

  private parseDifficulty(value: string): HabitDifficulty | null {
    const normalized = value.trim().toLowerCase();
    return DIFFICULTIES.includes(normalized as HabitDifficulty)
      ? (normalized as HabitDifficulty)
      : null;
  }

  private colorForDifficulty(difficulty: HabitDifficulty): number {
    if (difficulty === 'hard') return 0x9f1239;
    if (difficulty === 'medium') return 0xd97706;
    return 0x047857;
  }

  private activeUserId(): string | null {
    return auth.currentUser?.uid ?? (useLocalDemoData() ? LOCAL_DEMO_USER_ID : null);
  }
}
