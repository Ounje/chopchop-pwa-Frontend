export type SpecialType = 'h' | 'v' | 'c' | 'b';

export interface FoodItem {
  k: string;
  n: string;
  a: string;
}

export interface Tile {
  id: number;
  t: number;                // Food index in FOODS array (-1 if special wildcard)
  s: SpecialType | null;    // Special type: h, v, c, b
  r: number;                // Row (0 to 7)
  c: number;                // Column (0 to 7)
  el: HTMLDivElement | null;
  target?: number;          // Target food type for Chef Special
}

export interface LevelObjective {
  food: string;
  target: number;
}

export interface LevelConfig {
  level: number;
  moves: number;
  kinds: number;
  objectives: LevelObjective[];
  stars: [number, number];
  timeLimit?: number;       // In seconds (optional timer for timed levels)
  title?: string;           // Optional level name / flavor
  isRush?: boolean;         // True if timed kitchen rush order
}

export interface DailyQuest {
  id: string;
  t: string;
  key: string;
  n: number;
  r: number;
  max?: number;
}

export interface DailyProgress {
  date: string;
  p: Record<string, number>;
  claimed: Record<string, number>;
}

export interface PlayerData {
  unlocked: number;
  stars: Record<number, number>;
  best: Record<number, number>;
  coins: number;
  sound: boolean;
  daily: DailyProgress;
  handle: string;
  platform: 'x' | 'ig';
  skip: number;
  pid: string;
}

export interface LeaderboardEntry {
  rank: number;
  handle: string;
  platform: string;
  total: number;
  levels: number;
  updated: string;
}

export interface MonthlyTournamentData {
  monthKey: string;
  monthName: string;
  daysRemaining: number;
  hoursRemaining: number;
  rewardDescription: string;
  topWinner: LeaderboardEntry | null;
  standings: LeaderboardEntry[];
}

export interface GameRunState {
  levelNumber: number;
  cfg: LevelConfig;
  score: number;
  movesRemaining: number;
  objectivesLeft: Record<string, number>;
  isBusy: boolean;
  chickenMatched: number;
  bombsCreated: number;
  specialsMade: number;
  maxCombo: number;
  runToken: string | null;
  secondsRemaining: number | null;
  timerIntervalId?: any;
}
