import { StorageManager } from '../storage/StorageManager.js';
import { SoundManager } from '../audio/SoundManager.js';
import { ApiClient } from '../api/ApiClient.js';
import { MAX_LEVELS, getLevelConfig } from '../config/levels.js';
import { DAILY_QUESTS, getTodayDateString } from '../config/dailies.js';
import { Modals } from './Modals.js';
import { LeaderboardEntry } from '../types/index.js';

export class ScreenManager {
  private currentScreen = 'load';
  private onSelectLevelCallback!: (level: number) => void;
  private activeLbTab: 'monthly' | 'weekly' | 'alltime' = 'monthly';

  public init(onSelectLevel: (level: number) => void): void {
    this.onSelectLevelCallback = onSelectLevel;
    this.setupGlobalNavigation();
    this.setupTournamentTabs();
    this.updateCoinsUI();
  }

  public show(screenId: string): void {
    this.currentScreen = screenId;
    document.querySelectorAll('.scr').forEach(scr => {
      scr.classList.toggle('on', scr.id === screenId);
    });

    if (screenId === 'map') {
      this.renderLevelMap();
    } else if (screenId === 'daily') {
      this.renderDailyChallenges();
    } else if (screenId === 'lb') {
      this.renderLeaderboard();
    }

    this.updateCoinsUI();
  }

  public getCurrentScreen(): string {
    return this.currentScreen;
  }

  public updateCoinsUI(): void {
    const player = StorageManager.get();
    document.querySelectorAll('.coins').forEach(el => {
      el.textContent = player.coins.toLocaleString();
    });

    const soundBtn = document.getElementById('snd');
    if (soundBtn) {
      soundBtn.textContent = `Sound: ${player.sound ? 'On' : 'Off'}`;
    }
  }

  public renderLevelMap(): void {
    const listEl = document.getElementById('list');
    if (!listEl) return;

    listEl.innerHTML = '';
    const player = StorageManager.get();

    for (let n = 1; n <= MAX_LEVELS; n++) {
      const cfg = getLevelConfig(n);
      const node = document.createElement('div');
      const isUnlocked = n <= player.unlocked;
      const stars = player.stars[n] || 0;
      const isCurrent = n === player.unlocked;
      const isRush = Boolean(cfg.isRush);

      node.className = `node ${isUnlocked ? '' : 'lock'} ${isCurrent ? 'cur' : ''} ${isRush ? 'rush-node' : ''}`;
      node.style.marginLeft = `${50 + Math.sin(n * 1.1) * 32}%`;
      node.style.transform = 'translateX(-50%)';

      if (isUnlocked) {
        const starsText = '★'.repeat(stars) + '☆'.repeat(3 - stars);
        node.innerHTML = `
          ${isRush ? '<span class="rush-badge">⚡</span>' : ''}
          ${n}
          <small>${starsText}</small>
        `;
        node.onclick = () => {
          SoundManager.play('click');
          this.onSelectLevelCallback(n);
        };
      } else {
        node.innerHTML = isRush ? '🔒⚡' : '🔒';
      }

      listEl.appendChild(node);
    }

    setTimeout(() => {
      const currentNode = listEl.querySelector('.cur');
      if (currentNode) {
        currentNode.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }, 40);
  }

  public renderDailyChallenges(): void {
    const dlEl = document.getElementById('dl');
    if (!dlEl) return;

    const player = StorageManager.get();
    const today = getTodayDateString();

    if (player.daily.date !== today) {
      player.daily = { date: today, p: {}, claimed: {} };
      StorageManager.save();
    }

    const d = player.daily;
    dlEl.innerHTML = DAILY_QUESTS.map(quest => {
      const progress = Math.min(quest.n, d.p[quest.id] || 0);
      const isClaimed = Boolean(d.claimed[quest.id]);

      return `
        <div class="row">
          <span>
            <b>${quest.t}</b><br>
            <small style="opacity:0.8">${progress} / ${quest.n}</small>
          </span>
          <span style="color:var(--y)">
            ${isClaimed ? 'CLAIMED ✓' : `+${quest.r} Coins`}
          </span>
        </div>
      `;
    }).join('');
  }

  public async renderLeaderboard(): Promise<void> {
    const lblEl = document.getElementById('lbl');
    const lbnEl = document.getElementById('lbn');
    const lbjBtn = document.getElementById('lbj');
    if (!lblEl) return;

    const player = StorageManager.get();
    lblEl.textContent = 'Loading tournament rankings...';

    if (lbjBtn) {
      lbjBtn.textContent = player.handle ? 'CHANGE HANDLE' : 'JOIN THE BOARD';
    }

    // 1. MONTHLY CHAMPIONSHIP TAB
    if (this.activeLbTab === 'monthly') {
      const monthlyRes = await ApiClient.getMonthlyTournament();
      lblEl.textContent = '';

      if (monthlyRes?.tournament) {
        const t = monthlyRes.tournament;
        if (lbnEl) lbnEl.textContent = `${t.monthName} — Month-End Grand Reward`;

        // Monthly Tournament Banner
        const tourneyBanner = document.createElement('div');
        tourneyBanner.className = 'tournament-card';
        tourneyBanner.innerHTML = `
          <div class="tourney-header">
            <span>🏆 <b>${t.monthName}</b></span>
            <span class="countdown-tag">⏳ ${t.daysRemaining}d ${t.hoursRemaining}h left</span>
          </div>
          <div class="tourney-prize">
            🎁 <b>Grand Champion Reward:</b> #1 on the leaderboard at month-end receives the Official OunjeFood Culinary Prize!
          </div>
        `;
        lblEl.appendChild(tourneyBanner);

        // Render Top 3 Podium if scores exist
        if (t.standings && t.standings.length > 0) {
          this.renderPodium(lblEl, t.standings.slice(0, 3));
          this.renderScoreList(lblEl, t.standings, player.handle);
        } else {
          lblEl.innerHTML += '<div style="padding:16px;opacity:0.8;text-align:center;">No monthly scores recorded yet. Be the first to play and lead!</div>';
        }
        return;
      }
    }

    // 2. WEEKLY RUSH TAB
    if (this.activeLbTab === 'weekly') {
      const weeklyScores = await ApiClient.getWeeklyLeaderboard();
      lblEl.textContent = '';
      if (lbnEl) lbnEl.textContent = '⚡ Weekly Hotlist — Top 7-Day Scorers';

      if (weeklyScores && weeklyScores.length > 0) {
        this.renderScoreList(lblEl, weeklyScores, player.handle);
      } else {
        lblEl.innerHTML = '<div style="padding:16px;opacity:0.8;text-align:center;">No weekly scores yet. Play now to get on the hotlist!</div>';
      }
      return;
    }

    // 3. ALL-TIME LEGENDS TAB
    const winnersData = await ApiClient.getWinnersData();
    lblEl.textContent = '';
    if (lbnEl) lbnEl.textContent = '🌟 All-Time Hall of Fame — Best Combined Level Scores';

    if (winnersData?.topWinners && winnersData.topWinners.length > 0) {
      // Stats Bar
      const summaryBar = document.createElement('div');
      summaryBar.style.cssText = 'display:flex;gap:6px;justify-content:center;margin-bottom:10px;font-size:13px;font-weight:800;opacity:0.9;';
      summaryBar.innerHTML = `
        <span style="background:rgba(0,0,0,0.3);padding:3px 10px;border-radius:10px;">👥 ${winnersData.summary.totalPlayers || winnersData.topWinners.length} Players</span>
        <span style="background:rgba(0,0,0,0.3);padding:3px 10px;border-radius:10px;">🎮 ${winnersData.summary.totalGamesPlayed || 0} Games</span>
        <span style="background:rgba(0,0,0,0.3);padding:3px 10px;border-radius:10px;color:var(--y)">🔥 ${winnersData.summary.totalHighScoresRecorded || 0} Records</span>
      `;
      lblEl.appendChild(summaryBar);

      this.renderScoreList(lblEl, winnersData.topWinners, player.handle);

      // Live High Scores Ticker
      if (winnersData.recentHighScores && winnersData.recentHighScores.length > 0) {
        const tickerHeader = document.createElement('div');
        tickerHeader.style.cssText = 'font-size:15px;font-weight:800;color:var(--y);margin:14px 0 6px;text-align:left;';
        tickerHeader.textContent = '⚡ RECENT HIGH SCORES BREAKTHROUGHS';
        lblEl.appendChild(tickerHeader);

        winnersData.recentHighScores.slice(0, 5).forEach(hs => {
          const hsRow = document.createElement('div');
          hsRow.style.cssText = 'display:flex;justify-content:space-between;padding:6px 12px;margin:4px 0;background:rgba(0,0,0,0.2);border-radius:10px;font-size:13px;font-weight:800;';
          hsRow.innerHTML = `
            <span>${hs.isAllTimeLeader ? '👑' : '⭐'} @${hs.handle} <small style="opacity:0.7">Level ${hs.level}</small></span>
            <span style="color:var(--y)">+${Number(hs.score).toLocaleString()} pts</span>
          `;
          lblEl.appendChild(hsRow);
        });
      }
    } else {
      // Local fallback
      if (player.handle) {
        const localTotal = StorageManager.getTotalScore();
        const row = document.createElement('div');
        row.className = 'row me';
        row.innerHTML = `
          <span><span class="rk">#1</span>@${player.handle} <small class="tg">${player.platform.toUpperCase()}</small></span>
          <span style="color:var(--y)">${localTotal.toLocaleString()}</span>
        `;
        lblEl.appendChild(row);
      } else {
        lblEl.innerHTML = '<div style="padding:16px;opacity:0.8;text-align:center;">No scores recorded yet. Join the board and play!</div>';
      }
    }
  }

  private renderPodium(container: HTMLElement, topThree: LeaderboardEntry[]): void {
    if (!topThree.length) return;
    const podiumEl = document.createElement('div');
    podiumEl.className = 'podium-container';

    const order = [topThree[1], topThree[0], topThree[2]].filter(Boolean);
    order.forEach(entry => {
      if (!entry) return;
      const rank = entry.rank;
      const card = document.createElement('div');
      card.className = `podium-card rank-${rank}`;
      card.innerHTML = `
        <div class="podium-crown">${rank === 1 ? '👑' : rank === 2 ? '🥈' : '🥉'}</div>
        <div class="podium-name">@${entry.handle}</div>
        <div class="podium-pts">${Number(entry.total).toLocaleString()}</div>
        <div class="podium-rank-tag">#${rank}</div>
      `;
      podiumEl.appendChild(card);
    });

    container.appendChild(podiumEl);
  }

  private renderScoreList(container: HTMLElement, entries: LeaderboardEntry[], myHandle: string): void {
    entries.forEach(entry => {
      const isMe = Boolean(myHandle && entry.handle.toLowerCase() === myHandle.toLowerCase());
      const row = document.createElement('div');
      row.className = `row ${isMe ? 'me' : ''}`;

      const leftSpan = document.createElement('span');
      const rankSpan = document.createElement('span');
      rankSpan.className = 'rk';
      rankSpan.textContent = `#${entry.rank}`;

      leftSpan.append(rankSpan, `@${entry.handle}`);

      const tag = document.createElement('small');
      tag.className = 'tg';
      tag.textContent = entry.platform === 'ig' ? 'IG' : 'X';
      leftSpan.append(tag);

      const rightSpan = document.createElement('span');
      rightSpan.style.color = 'var(--y)';
      rightSpan.textContent = Number(entry.total).toLocaleString();

      row.append(leftSpan, rightSpan);
      container.appendChild(row);
    });
  }

  private setupTournamentTabs(): void {
    document.addEventListener('click', (e: MouseEvent) => {
      const tabBtn = (e.target as HTMLElement).closest('.lb-tab') as HTMLElement | null;
      if (tabBtn && tabBtn.dataset.tab) {
        SoundManager.play('click');
        this.activeLbTab = tabBtn.dataset.tab as any;
        document.querySelectorAll('.lb-tab').forEach(b => b.classList.toggle('active', b === tabBtn));
        void this.renderLeaderboard();
      }
    });
  }

  private setupGlobalNavigation(): void {
    document.addEventListener('click', (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const navBtn = target.closest('[data-go]') as HTMLElement | null;

      if (navBtn) {
        SoundManager.play('click');
        const targetScreen = navBtn.dataset.go;
        if (!targetScreen) return;

        // Auto prompt handle if first time going to map
        if (targetScreen === 'map' && navBtn.closest('#menu')) {
          const player = StorageManager.get();
          if (!player.handle && !player.skip) {
            Modals.show('mjoin');
            return;
          }
        }

        Modals.hideAll();
        this.show(targetScreen);
      }
    });

    // Sound toggle
    const soundBtn = document.getElementById('snd');
    if (soundBtn) {
      soundBtn.onclick = () => {
        const player = StorageManager.get();
        player.sound = !player.sound;
        StorageManager.save();
        SoundManager.setEnabled(player.sound);
        this.updateCoinsUI();
        SoundManager.play('click');
      };
    }

    // Reset progress
    const resetBtn = document.getElementById('rst');
    if (resetBtn) {
      resetBtn.onclick = () => {
        if (confirm('Reset all progress and scores?')) {
          StorageManager.reset();
          this.updateCoinsUI();
          this.show('menu');
        }
      };
    }

    // Leaderboard join dialog triggers
    document.getElementById('lbj')?.addEventListener('click', () => {
      SoundManager.play('click');
      Modals.show('mjoin');
    });

    document.getElementById('sh')?.addEventListener('click', () => {
      SoundManager.play('click');
      Modals.show('mjoin');
    });
  }
}
