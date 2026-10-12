import { PlayerData } from '../types/index.js';
import { getTodayDateString } from '../config/dailies.js';

const STORAGE_KEY = 'chopchop_v2';
const LEGACY_STORAGE_KEY = 'chopchop_v1';

export class StorageManager {
  private static data: PlayerData;

  private static generatePid(): string {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  public static init(): PlayerData {
    let parsed: Partial<PlayerData> | null = null;

    try {
      const raw = localStorage.getItem(STORAGE_KEY) || localStorage.getItem(LEGACY_STORAGE_KEY);
      if (raw) {
        parsed = JSON.parse(raw);
      }
    } catch {
      parsed = null;
    }

    const defaultPid = this.generatePid();

    this.data = {
      unlocked: parsed?.unlocked || 1,
      stars: parsed?.stars || {},
      best: parsed?.best || {},
      coins: typeof parsed?.coins === 'number' ? parsed.coins : 0,
      sound: typeof parsed?.sound === 'boolean' ? parsed.sound : true,
      daily: parsed?.daily && parsed.daily.date === getTodayDateString() 
        ? parsed.daily 
        : { date: getTodayDateString(), p: {}, claimed: {} },
      handle: parsed?.handle || '',
      platform: parsed?.platform === 'ig' ? 'ig' : 'x',
      skip: parsed?.skip || 0,
      pid: parsed?.pid || defaultPid
    };

    this.save();
    return this.data;
  }

  public static get(): PlayerData {
    if (!this.data) {
      return this.init();
    }
    return this.data;
  }

  public static save(): void {
    if (!this.data) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
    } catch {
      // Storage quota or privacy sandbox limit
    }
  }

  public static reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch {}
    this.init();
  }

  public static getTotalScore(): number {
    const bests = this.get().best;
    return Object.values(bests).reduce((sum, val) => sum + Number(val || 0), 0);
  }
}
