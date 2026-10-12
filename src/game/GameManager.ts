import { LevelConfig, GameRunState } from '../types/index.js';
import { getLevelConfig, MAX_LEVELS } from '../config/levels.js';
import { DAILY_QUESTS, getTodayDateString } from '../config/dailies.js';
import { FOODS } from '../config/foods.js';
import { StorageManager } from '../storage/StorageManager.js';
import { SoundManager } from '../audio/SoundManager.js';
import { ApiClient } from '../api/ApiClient.js';
import { BoardEngine } from './BoardEngine.js';
import { ParticleFx } from '../ui/ParticleFx.js';

export interface GameManagerDelegate {
  onHudUpdate: (
    level: number,
    score: number,
    moves: number,
    objectives: Record<string, number>,
    cfg: LevelConfig,
    secondsRemaining: number | null
  ) => void;
  onShowModal: (modalId: string, data?: any) => void;
  onHideModals: () => void;
  onShowScreen: (screenId: string) => void;
  onToast: (message: string) => void;
}

export class GameManager {
  private boardEngine: BoardEngine;
  private delegate: GameManagerDelegate;
  private state: GameRunState | null = null;
  private timerInterval: any = null;

  constructor(boardEngine: BoardEngine, delegate: GameManagerDelegate) {
    this.boardEngine = boardEngine;
    this.delegate = delegate;
  }

  public getState(): GameRunState | null {
    return this.state;
  }

  public async startLevel(levelNumber: number): Promise<void> {
    this.stopTimer();

    const cfg = getLevelConfig(levelNumber);
    const objectivesLeft: Record<string, number> = {};
    cfg.objectives.forEach(o => {
      objectivesLeft[o.food] = o.target;
    });

    this.state = {
      levelNumber,
      cfg,
      score: 0,
      movesRemaining: cfg.moves,
      objectivesLeft,
      isBusy: true,
      chickenMatched: 0,
      bombsCreated: 0,
      specialsMade: 0,
      maxCombo: 0,
      runToken: null,
      secondsRemaining: cfg.timeLimit !== undefined ? cfg.timeLimit : null
    };

    // Request anti-cheat run token from backend if handle registered
    const player = StorageManager.get();
    if (player.handle) {
      ApiClient.startRun(player.handle, levelNumber).then(token => {
        if (this.state && this.state.levelNumber === levelNumber) {
          this.state.runToken = token;
        }
      });
    }

    this.delegate.onShowScreen('game');
    this.updateHud();

    // Initialize board
    this.boardEngine.init(cfg, {
      onScoreGain: (points, combo) => this.handleScoreGain(points, combo),
      onObjectiveProgress: (foodKey, count) => this.handleObjectiveProgress(foodKey, count),
      onMoveSpent: () => this.handleMoveSpent(),
      onChickenMatched: count => this.handleChickenMatched(count),
      onBombCreated: count => this.handleBombCreated(count),
      onComboAchieved: combo => this.handleComboAchieved(combo),
      onCheckGameEnd: () => this.checkGameEnd()
    });

    // Show Level Preview Start modal
    this.delegate.onShowModal('mstart', { cfg });
  }

  public beginPlaying(): void {
    if (this.state) {
      this.state.isBusy = false;
      this.boardEngine.setBusy(false);

      if (this.state.secondsRemaining !== null && this.state.secondsRemaining > 0) {
        this.startTimerCountdown();
      }
    }
  }

  public pauseGame(): void {
    this.stopTimer();
    if (this.state) {
      this.state.isBusy = true;
      this.boardEngine.setBusy(true);
    }
  }

  public resumeGame(): void {
    if (this.state) {
      this.state.isBusy = false;
      this.boardEngine.setBusy(false);
      if (this.state.secondsRemaining !== null && this.state.secondsRemaining > 0) {
        this.startTimerCountdown();
      }
    }
  }

  private startTimerCountdown(): void {
    this.stopTimer();
    this.timerInterval = setInterval(() => {
      if (!this.state || this.state.isBusy) return;

      if (this.state.secondsRemaining !== null && this.state.secondsRemaining > 0) {
        this.state.secondsRemaining--;
        this.updateHud();

        // Audio and visual warning when 10 seconds remain
        if (this.state.secondsRemaining <= 10 && this.state.secondsRemaining > 0) {
          SoundManager.play('tap');
        }

        // Time ran out!
        if (this.state.secondsRemaining <= 0) {
          this.stopTimer();
          SoundManager.play('bad');
          ParticleFx.banner(document.getElementById('board')!, "TIME'S UP!");
          void this.finishGame(false, "Time's up!");
        }
      }
    }, 1000);
  }

  private stopTimer(): void {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private updateHud(): void {
    if (!this.state) return;
    this.delegate.onHudUpdate(
      this.state.levelNumber,
      this.state.score,
      this.state.movesRemaining,
      this.state.objectivesLeft,
      this.state.cfg,
      this.state.secondsRemaining
    );
  }

  private handleScoreGain(points: number, _combo: number): void {
    if (!this.state) return;
    this.state.score += points;
    this.updateHud();
  }

  private handleObjectiveProgress(foodKey: string, count: number): void {
    if (!this.state) return;
    if (this.state.objectivesLeft[foodKey] > 0) {
      this.state.objectivesLeft[foodKey] = Math.max(0, this.state.objectivesLeft[foodKey] - count);
      if (this.state.objectivesLeft[foodKey] === 0) {
        const food = FOODS.find(f => f.k === foodKey);
        const name = food ? food.n.toUpperCase() : foodKey.toUpperCase();
        ParticleFx.banner(document.getElementById('board')!, `${name} COMPLETE!`);
        SoundManager.play('make');
      }
      this.updateHud();
    }
  }

  private handleMoveSpent(): void {
    if (!this.state) return;
    this.state.movesRemaining--;
    this.updateHud();
  }

  private handleChickenMatched(count: number): void {
    if (!this.state) return;
    this.state.chickenMatched += count;
    this.trackDailyStat('chicken', count);
  }

  private handleBombCreated(count: number): void {
    if (!this.state) return;
    this.state.bombsCreated += count;
    this.state.specialsMade += count;
    this.trackDailyStat('bomb', count);
  }

  private handleComboAchieved(combo: number): void {
    if (!this.state) return;
    this.state.maxCombo = Math.max(this.state.maxCombo, combo);
    this.trackDailyStat('combo', combo, true);
  }

  public checkGameEnd(): void {
    if (!this.state) return;

    const isWon = this.state.cfg.objectives.every(o => this.state!.objectivesLeft[o.food] <= 0);
    if (isWon) {
      this.stopTimer();
      setTimeout(() => this.finishGame(true), 350);
      return;
    }

    if (this.state.movesRemaining <= 0) {
      this.stopTimer();
      setTimeout(() => this.finishGame(false), 350);
    }
  }

  private async finishGame(isWin: boolean, customReason?: string): Promise<void> {
    if (!this.state) return;
    this.stopTimer();
    this.boardEngine.setBusy(true);

    const s = this.state;
    const player = StorageManager.get();

    // Calculate moves and speed bonus on win
    let movesBonus = 0;
    let timeBonus = 0;

    if (isWin) {
      movesBonus = s.movesRemaining * 120;
      if (s.secondsRemaining !== null && s.secondsRemaining > 0) {
        timeBonus = s.secondsRemaining * 60;
      }
      s.score += movesBonus + timeBonus;
    }

    const bestBefore = player.best[s.levelNumber] || 0;
    const newBest = Math.max(bestBefore, s.score);
    player.best[s.levelNumber] = newBest;

    if (isWin) {
      const starRating = s.score >= s.cfg.stars[1] ? 3 : s.score >= s.cfg.stars[0] ? 2 : 1;
      const coinsEarned = 50 + starRating * 25 + Math.min(s.maxCombo, 6) * 10 + s.specialsMade * 10;

      player.stars[s.levelNumber] = Math.max(player.stars[s.levelNumber] || 0, starRating);
      player.coins += coinsEarned;
      player.unlocked = Math.max(player.unlocked, Math.min(MAX_LEVELS, s.levelNumber + 1));

      StorageManager.save();
      this.trackDailyStat('levels', 1);
      SoundManager.play('win');

      // Submit verified score to backend and track rank climb
      let rankInfo: { newRank?: number; isAllTimeLeader?: boolean; isHighScore?: boolean } = {};

      if (player.handle && s.runToken) {
        try {
          const res = await ApiClient.finishRun({
            handle: player.handle,
            level: s.levelNumber,
            score: s.score,
            moves: Math.max(1, s.cfg.moves - s.movesRemaining),
            token: s.runToken,
            pid: player.pid,
            platform: player.platform
          });
          if (res) {
            rankInfo = {
              newRank: (res as any).rank,
              isAllTimeLeader: res.isAllTimeLeader,
              isHighScore: res.isHighScore
            };
            if (res.isAllTimeLeader) {
              this.delegate.onToast('👑 NEW #1 GLOBAL LEADER!');
            } else if (res.isHighScore) {
              this.delegate.onToast('🏆 NEW PERSONAL HIGH SCORE!');
            }
          }
        } catch {}
      }

      this.delegate.onShowModal('mend_win', {
        level: s.levelNumber,
        score: s.score,
        best: newBest,
        stars: starRating,
        coins: coinsEarned,
        movesBonus,
        timeBonus,
        newRank: rankInfo.newRank,
        isAllTimeLeader: rankInfo.isAllTimeLeader,
        hasNext: s.levelNumber < MAX_LEVELS
      });
    } else {
      StorageManager.save();

      if (player.handle && s.runToken) {
        ApiClient.finishRun({
          handle: player.handle,
          level: s.levelNumber,
          score: s.score,
          moves: Math.max(1, s.cfg.moves - s.movesRemaining),
          token: s.runToken,
          pid: player.pid,
          platform: player.platform
        });
      }

      const remainingObjectives = s.cfg.objectives.filter(o => s.objectivesLeft[o.food] > 0);

      this.delegate.onShowModal('mend_lose', {
        level: s.levelNumber,
        score: s.score,
        best: newBest,
        reason: customReason || (s.movesRemaining <= 0 ? 'Out of moves!' : 'Kitchen order failed!'),
        remaining: remainingObjectives.map(o => ({
          foodName: FOODS.find(f => f.k === o.food)?.n || o.food,
          count: s.objectivesLeft[o.food]
        }))
      });
    }
  }

  private trackDailyStat(key: string, n: number, isMax = false): void {
    const player = StorageManager.get();
    const today = getTodayDateString();

    if (player.daily.date !== today) {
      player.daily = { date: today, p: {}, claimed: {} };
    }

    const d = player.daily;
    d.p[key] = isMax ? Math.max(d.p[key] || 0, n) : (d.p[key] || 0) + n;

    DAILY_QUESTS.forEach(quest => {
      if (quest.key === key && (d.p[key] || 0) >= quest.n && !d.claimed[quest.id]) {
        d.claimed[quest.id] = 1;
        player.coins += quest.r;
        this.delegate.onToast(`DAILY DONE! +${quest.r} COINS`);
        SoundManager.play('win');
      }
    });

    StorageManager.save();
  }
}
