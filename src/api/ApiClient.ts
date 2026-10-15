import { LeaderboardEntry } from '../types/index.js';
import { StorageManager } from '../storage/StorageManager.js';

export interface HighScoreEvent {
  id: string;
  handle: string;
  platform: string;
  level: number;
  score: number;
  isAllTimeLeader: boolean;
  created: string;
}

export interface WinnersData {
  summary: {
    totalPlayers: number;
    totalGamesPlayed: number;
    totalWins: number;
    totalHighScoresRecorded: number;
    winRatePercentage: number;
    topWinner: {
      handle: string;
      platform: string;
      total: number;
    } | null;
  };
  topWinners: LeaderboardEntry[];
  recentHighScores: HighScoreEvent[];
}

export class ApiClient {
  // Base URL for API calls. If hosted on a separate server, set VITE_API_URL.
  // When running in production on a remote host (e.g. Vercel), defaults to the live backend.
  // When running locally on localhost without VITE_API_URL, uses relative paths which Vite proxies to localhost:3001.
  private static baseUrl = (
    import.meta.env.VITE_API_URL ||
    (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1'
      ? 'https://chopchop-pwa-backend.pxxl.pro'
      : '')
  ).replace(/\/$/, '');

  public static async checkHealth(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/health`, { method: 'GET' });
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async getLeaderboard(limit = 50): Promise<LeaderboardEntry[] | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/leaderboard?limit=${limit}`);
      if (!res.ok) return null;
      const json = await res.json().catch(() => ({}));
      return json.scores || [];
    } catch {
      return null;
    }
  }

  public static async getWinnersData(): Promise<WinnersData | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/winners`);
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch {
      return null;
    }
  }

  public static async getMonthlyTournament(): Promise<{ tournament: any } | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/leaderboard/monthly`);
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch {
      return null;
    }
  }

  public static async getWeeklyLeaderboard(): Promise<LeaderboardEntry[] | null> {
    try {
      const res = await fetch(`${this.baseUrl}/api/leaderboard/weekly`);
      if (!res.ok) return null;
      const json = await res.json().catch(() => ({}));
      return json.scores || [];
    } catch {
      return null;
    }
  }

  public static async startRun(handle: string, level: number): Promise<string | null> {
    if (!handle) return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/game/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, level })
      });
      if (!res.ok) return null;
      const json = await res.json().catch(() => ({}));
      return json.token || null;
    } catch {
      return null;
    }
  }

  public static async finishRun(params: {
    handle: string;
    level: number;
    score: number;
    moves: number;
    token: string;
    pid: string;
    platform: string;
  }): Promise<{ ok: boolean; total?: number; isHighScore?: boolean; isAllTimeLeader?: boolean } | null> {
    if (!params.handle || !params.token) return null;
    try {
      const res = await fetch(`${this.baseUrl}/api/game/finish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      if (!res.ok) return null;
      return await res.json().catch(() => null);
    } catch {
      return null;
    }
  }

  public static async registerPlayer(handle: string, platform: 'x' | 'ig'): Promise<{ success: boolean; error?: string }> {
    const pid = StorageManager.get().pid;
    try {
      const res = await fetch(`${this.baseUrl}/api/player/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle, platform, pid })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { success: false, error: (data as any)?.error || `Server error (${res.status})` };
      }
      return { success: true };
    } catch (err) {
      console.error('[ApiClient] registerPlayer error:', err);
      return { success: false, error: 'Could not connect to leaderboard server.' };
    }
  }
}
