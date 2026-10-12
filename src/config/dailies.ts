import { DailyQuest } from '../types/index.js';

export const DAILY_QUESTS: DailyQuest[] = [
  { id: 'chicken', t: 'Match 50 Chicken', key: 'chicken', n: 50, r: 100 },
  { id: 'bomb', t: 'Create 3 Food Bombs', key: 'bomb', n: 3, r: 150 },
  { id: 'levels', t: 'Complete 3 Levels', key: 'levels', n: 3, r: 120 },
  { id: 'combo', t: 'Reach a 5x Combo', key: 'combo', n: 5, r: 150, max: 1 }
];

export function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}
