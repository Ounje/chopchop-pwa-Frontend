import { LevelConfig } from '../types/index.js';
import { FOODS } from './foods.js';

export const MAX_LEVELS = 40;

// Curated handcrafted levels with smooth progressive difficulty curve and timed rush orders
export const HANDCRAFTED_LEVELS: LevelConfig[] = [
  // Phase 1: Kitchen Apprentice (Levels 1 - 5)
  {
    level: 1,
    title: 'Welcome to Ounje Kitchen',
    moves: 25,
    kinds: 4,
    objectives: [
      { food: 'jollof', target: 8 },
      { food: 'chicken', target: 8 }
    ],
    stars: [1200, 2400]
  },
  {
    level: 2,
    title: 'Plantain Fryer',
    moves: 23,
    kinds: 4,
    objectives: [
      { food: 'plantain', target: 10 },
      { food: 'jollof', target: 10 }
    ],
    stars: [1600, 3000]
  },
  {
    level: 3,
    title: 'Buka Classics',
    moves: 22,
    kinds: 5,
    objectives: [
      { food: 'amala', target: 12 },
      { food: 'chicken', target: 10 },
      { food: 'plantain', target: 10 }
    ],
    stars: [2000, 3800]
  },
  {
    level: 4,
    title: 'Street Snack Corner',
    moves: 21,
    kinds: 5,
    objectives: [
      { food: 'puffpuff', target: 12 },
      { food: 'suya', target: 12 },
      { food: 'jollof', target: 10 }
    ],
    stars: [2400, 4400]
  },
  {
    level: 5,
    title: 'Party Jollof Special',
    moves: 20,
    kinds: 5,
    objectives: [
      { food: 'jollof', target: 15 },
      { food: 'chicken', target: 14 },
      { food: 'moimoi', target: 12 }
    ],
    stars: [2800, 5000]
  },

  // Phase 2: Sous Chef & Timed Rush (Levels 6 - 10)
  {
    level: 6,
    title: 'Fisherman Stew',
    moves: 20,
    kinds: 6,
    objectives: [
      { food: 'fish', target: 14 },
      { food: 'meatpie', target: 14 },
      { food: 'plantain', target: 12 }
    ],
    stars: [3000, 5400]
  },
  {
    level: 7,
    title: 'Swallow Feast',
    moves: 19,
    kinds: 6,
    objectives: [
      { food: 'eba', target: 16 },
      { food: 'amala', target: 14 },
      { food: 'suya', target: 14 }
    ],
    stars: [3400, 6000]
  },
  {
    level: 8,
    title: '⚡ Lagos Lunch Rush (TIMED)',
    moves: 20,
    kinds: 6,
    isRush: true,
    timeLimit: 75, // 75 seconds countdown!
    objectives: [
      { food: 'jollof', target: 16 },
      { food: 'chicken', target: 14 },
      { food: 'puffpuff', target: 12 }
    ],
    stars: [3800, 6600]
  },
  {
    level: 9,
    title: 'Fried Rice Combo',
    moves: 18,
    kinds: 6,
    objectives: [
      { food: 'friedrice', target: 18 },
      { food: 'akara', target: 16 },
      { food: 'fish', target: 14 }
    ],
    stars: [4000, 7000]
  },
  {
    level: 10,
    title: '⚡ Head Chef Speed Trial (TIMED)',
    moves: 18,
    kinds: 6,
    isRush: true,
    timeLimit: 65, // 65 seconds!
    objectives: [
      { food: 'suya', target: 18 },
      { food: 'jollof', target: 18 },
      { food: 'chicken', target: 16 }
    ],
    stars: [4400, 7600]
  }
];

/**
 * Returns configuration for a level (handcrafted or procedurally scaled)
 * Every single level is progressively more challenging than the previous.
 */
export function getLevelConfig(level: number): LevelConfig {
  if (level <= HANDCRAFTED_LEVELS.length) {
    return HANDCRAFTED_LEVELS[level - 1];
  }

  // Progressive parameters for Levels 11 through 40
  const kinds = level >= 26 ? 8 : level >= 13 ? 7 : 6;
  const moves = Math.max(14, 21 - Math.floor(level / 4));

  // Determine if this is a Timed Kitchen Rush level (every 4 levels: 12, 16, 20, 24, 28, 32, 36, 40)
  const isRush = level % 4 === 0;
  const timeLimit = isRush ? Math.max(45, 80 - Math.floor(level * 0.9)) : undefined;

  const targetA = 14 + Math.floor(level * 0.8);
  const targetB = 12 + Math.floor(level * 0.7);
  const targetC = 10 + Math.floor(level * 0.6);

  const foodIdxA = (level * 2) % kinds;
  const foodIdxB = (level * 2 + 1) % kinds;
  const foodIdxC = (level * 2 + 2) % kinds;

  const objectives = [
    { food: FOODS[foodIdxA].k, target: targetA },
    { food: FOODS[foodIdxB].k, target: targetB },
    { food: FOODS[foodIdxC].k, target: targetC }
  ];

  const star2 = 3000 + level * 280;
  const star3 = 5400 + level * 450;

  return {
    level,
    title: isRush ? `⚡ Kitchen Rush ${level} (TIMED)` : `Chef Challenge ${level}`,
    moves,
    kinds,
    isRush,
    timeLimit,
    objectives,
    stars: [star2, star3]
  };
}
