import { SoundManager } from '../audio/SoundManager.js';
import { StorageManager } from '../storage/StorageManager.js';
import { ApiClient } from '../api/ApiClient.js';
import { FOODS, getFoodIconHtml } from '../config/foods.js';
import { ParticleFx } from './ParticleFx.js';

export class Modals {
  public static init(callbacks: {
    onStartGame: () => void;
    onRestartLevel: () => void;
    onNextLevel: () => void;
    onGoToMap: () => void;
    onRefreshLeaderboard: () => void;
    onResumeGame?: () => void;
  }): void {
    // Start modal button
    const goBtn = document.getElementById('go');
    if (goBtn) {
      goBtn.onclick = () => {
        SoundManager.play('click');
        this.hideAll();
        callbacks.onStartGame();
      };
    }

    // Pause modal buttons
    const resBtn = document.getElementById('res');
    if (resBtn) {
      resBtn.onclick = () => {
        SoundManager.play('click');
        this.hide('mpause');
        callbacks.onResumeGame?.();
      };
    }

    const rtryBtn = document.getElementById('rtry');
    if (rtryBtn) {
      rtryBtn.onclick = () => {
        SoundManager.play('click');
        this.hide('mpause');
        callbacks.onRestartLevel();
      };
    }

    // Join leaderboard modal
    const jokBtn = document.getElementById('jok');
    if (jokBtn) {
      jokBtn.onclick = async () => {
        const handleInput = document.getElementById('jh') as HTMLInputElement;
        const platformSelect = document.getElementById('jp') as HTMLSelectElement;
        const agreeCheckbox = document.getElementById('jc') as HTMLInputElement;
        const errEl = document.getElementById('je')!;

        const rawHandle = handleInput.value.trim().replace(/^@/, '');
        if (!/^[A-Za-z0-9_.]{1,30}$/.test(rawHandle)) {
          errEl.textContent = 'Use 1-30 letters, numbers, dots, or underscores only.';
          return;
        }

        if (!agreeCheckbox.checked) {
          errEl.textContent = 'Please tick the box to join.';
          return;
        }

        errEl.textContent = 'Registering...';
        const platform = (platformSelect.value === 'ig' ? 'ig' : 'x') as 'x' | 'ig';

        const result = await ApiClient.registerPlayer(rawHandle, platform);
        if (!result.success) {
          errEl.textContent = result.error || 'Failed to join.';
          return;
        }

        const player = StorageManager.get();
        player.handle = rawHandle.toLowerCase();
        player.platform = platform;
        player.skip = 0;
        StorageManager.save();

        SoundManager.play('click');
        this.hide('mjoin');
        callbacks.onRefreshLeaderboard();
      };
    }

    const jskipBtn = document.getElementById('jskip');
    if (jskipBtn) {
      jskipBtn.onclick = () => {
        const player = StorageManager.get();
        player.skip = 1;
        StorageManager.save();
        this.hide('mjoin');
      };
    }
  }

  public static show(modalId: string, data?: any): void {
    const modal = document.getElementById(modalId);
    if (!modal) return;

    if (modalId === 'mstart' && data?.cfg) {
      const cfg = data.cfg;
      const mst = document.getElementById('mst');
      const mso = document.getElementById('mso');
      if (mst) mst.textContent = cfg.title ? cfg.title.toUpperCase() : `LEVEL ${cfg.level}`;
      if (mso) {
        mso.innerHTML = cfg.objectives.map((o: any) => {
          const food = FOODS.find(f => f.k === o.food);
          return `<div>${food ? getFoodIconHtml(food) : ''} Collect ${o.target} ${food ? food.n : o.food}</div>`;
        }).join('') +
        `<div>🎯 Moves: <b>${cfg.moves}</b></div>` +
        (cfg.timeLimit ? `<div style="color:var(--y)">⏱️ Rush Timer: <b>${cfg.timeLimit} seconds!</b></div>` : '');
      }
    }

    if (modalId === 'mend_win' && data) {
      const modalEnd = document.getElementById('mend')!;
      ParticleFx.launchConfetti(modalEnd);

      const starsHtml = [1, 2, 3].map(i => 
        `<span class="s${i <= data.stars ? ' on' : ''}" style="animation-delay:${i * 0.28}s">★</span>`
      ).join('');

      const ratingLabel = data.stars === 3
        ? '★★★ Master Chef Rating!'
        : data.stars === 2
        ? '★★ Senior Cook Rating!'
        : '★ Line Cook Passed!';

      modalEnd.innerHTML = `
        <h2 style="font-size:38px;margin-bottom:2px;">ORDER MASTERED!</h2>
        <div class="stars" style="margin:4px 0 6px;">${starsHtml}</div>
        <div style="font-size:16px;font-weight:800;color:var(--y);letter-spacing:0.06em;margin-bottom:8px;">${ratingLabel}</div>

        <div style="font-size:36px;font-weight:800;color:var(--y);text-shadow:0 3px 0 var(--b);margin-bottom:10px;">
          ${data.score.toLocaleString()} <small style="font-size:18px;opacity:0.85;">PTS</small>
        </div>

        <!-- Detailed Scoring & Bonus Breakdown -->
        <div class="row" style="margin:3px 0;padding:6px 14px;font-size:15px;">
          <span>Unused Moves Bonus</span>
          <span style="color:var(--y)">+${(data.movesBonus || 0).toLocaleString()}</span>
        </div>
        ${data.timeBonus ? `
          <div class="row" style="margin:3px 0;padding:6px 14px;font-size:15px;background:rgba(255,201,60,0.18);border:1px solid rgba(255,201,60,0.4);">
            <span>⏱️ Speed & Time Bonus</span>
            <span style="color:var(--y)">+${data.timeBonus.toLocaleString()}</span>
          </div>
        ` : ''}
        <div class="row" style="margin:3px 0;padding:6px 14px;font-size:15px;">
          <span>Best Level Score</span>
          <span>${data.best.toLocaleString()}</span>
        </div>
        <div class="row" style="margin:3px 0;padding:6px 14px;font-size:15px;color:var(--y);">
          <span>OunjeCoins Earned</span>
          <span>+${data.coins} 🪙</span>
        </div>

        <!-- Leaderboard Rank Climb Widget -->
        <div class="rank-climb-card">
          <div class="rank-climb-title">🏆 TOURNAMENT STANDING</div>
          <div class="rank-climb-body">
            <span class="rank-badge ${data.isAllTimeLeader ? 'crown' : ''}">#${data.newRank || 1}</span>
            <div class="rank-climb-text">
              <b>${data.isAllTimeLeader ? '👑 #1 CHAMPION CONTENDER!' : '▲ RANK ASCENDED!'}</b><br>
              <small>Competing for Monthly Grand Prizes!</small>
            </div>
          </div>
        </div>

        <div style="margin-top:12px;display:flex;flex-direction:column;align-items:center;width:100%;">
          ${data.hasNext ? '<button class="btn" id="nx">NEXT LEVEL</button>' : ''}
          <button class="btn alt" id="shr">SHARE SCORE</button>
          <button class="btn alt" data-go="map">LEVEL MAP</button>
        </div>
      `;

      modalEnd.classList.add('on');
      document.getElementById('shr')?.addEventListener('click', () => this.shareScore(data.score));
      return;
    }

    if (modalId === 'mend_lose' && data) {
      const modalEnd = document.getElementById('mend')!;
      modalEnd.innerHTML = `
        <h2 style="font-size:38px;">WAHALA!</h2>
        <div class="sub" style="margin:6px 0 12px;color:var(--r);font-weight:800;">${data.reason || 'Kitchen order failed!'}</div>
        <div style="font-size:32px;font-weight:800;color:var(--y);margin-bottom:12px;">${data.score.toLocaleString()} POINTS</div>
        <div class="row" style="margin-bottom:8px;">
          <span>Remaining Orders</span>
          <span>${data.remaining.map((r: any) => `${r.count} ${r.foodName}`).join(', ')}</span>
        </div>
        <div class="row"><span>Best score</span><span>${data.best.toLocaleString()}</span></div>
        <div style="margin-top:14px;display:flex;flex-direction:column;align-items:center;width:100%;">
          <button class="btn" id="ta">TRY AGAIN</button>
          <button class="btn alt" id="shr">SHARE SCORE</button>
          <button class="btn alt" data-go="map">LEVEL MAP</button>
        </div>
      `;

      modalEnd.classList.add('on');
      document.getElementById('shr')?.addEventListener('click', () => this.shareScore(data.score));
      return;
    }

    modal.classList.add('on');
  }

  public static hide(modalId: string): void {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('on');
  }

  public static hideAll(): void {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('on'));
  }

  public static shareScore(score: number): void {
    const text = `I scored ${score.toLocaleString()} on CHOP CHOP by OunjeFood! Can you beat my order?`;
    const url = window.location.href.split('#')[0];

    if (navigator.share) {
      navigator.share({ title: 'CHOP CHOP | OunjeFood', text, url }).catch(() => {});
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    }
  }
}
