import './styles/variables.css';
import './styles/main.css';
import './styles/board.css';
import './styles/screens.css';
import './styles/modals.css';

import { StorageManager } from './storage/StorageManager.js';
import { SoundManager } from './audio/SoundManager.js';
import { ScreenManager } from './ui/ScreenManager.js';
import { Modals } from './ui/Modals.js';
import { BoardEngine } from './game/BoardEngine.js';
import { GameManager } from './game/GameManager.js';
import { FOODS, getFoodIconHtml } from './config/foods.js';
import { ParticleFx } from './ui/ParticleFx.js';

// 1. Initialize Player Storage
const playerData = StorageManager.init();
SoundManager.setEnabled(playerData.sound);

// 2. Initialize UI Managers
const boardEl = document.getElementById('board') as HTMLElement;
const boardEngine = new BoardEngine(boardEl);
const screenManager = new ScreenManager();

// 3. Initialize Game Manager
const gameManager = new GameManager(boardEngine, {
  onHudUpdate: (level, score, moves, objectives, cfg, secondsRemaining) => {
    const lvEl = document.getElementById('lv');
    const scEl = document.getElementById('sc');
    const mvEl = document.getElementById('mv');
    const obsEl = document.getElementById('obs');
    const tmPill = document.getElementById('tm-pill');
    const tmSpan = document.getElementById('tm');

    if (lvEl) lvEl.textContent = String(level);
    if (scEl) scEl.textContent = score.toLocaleString();
    if (mvEl) mvEl.textContent = String(moves);

    // Update Countdown Timer Pill
    if (secondsRemaining !== null && tmPill && tmSpan) {
      tmPill.style.display = 'flex';
      const m = Math.floor(secondsRemaining / 60);
      const s = secondsRemaining % 60;
      tmSpan.textContent = `${m}:${s.toString().padStart(2, '0')}`;
      tmPill.classList.toggle('urgent', secondsRemaining <= 10);
    } else if (tmPill) {
      tmPill.style.display = 'none';
    }

    if (obsEl) {
      obsEl.innerHTML = cfg.objectives.map(o => {
        const food = FOODS.find(f => f.k === o.food);
        const countLeft = Math.max(0, objectives[o.food] || 0);
        const isDone = countLeft === 0;
        const iconHtml = food ? getFoodIconHtml(food) : '';
        return `
          <div class="ob ${isDone ? 'done' : ''}">
            ${iconHtml} ${o.target - countLeft} / ${o.target}
          </div>
        `;
      }).join('');
    }
  },

  onShowModal: (modalId, data) => {
    Modals.show(modalId, data);
  },

  onHideModals: () => {
    Modals.hideAll();
  },

  onShowScreen: (screenId) => {
    screenManager.show(screenId);
  },

  onToast: (msg) => {
    ParticleFx.banner(document.body, msg);
  }
});

// 4. Initialize Modals with action handlers
Modals.init({
  onStartGame: () => {
    gameManager.beginPlaying();
  },
  onRestartLevel: () => {
    const state = gameManager.getState();
    if (state) {
      void gameManager.startLevel(state.levelNumber);
    }
  },
  onNextLevel: () => {
    const state = gameManager.getState();
    if (state) {
      void gameManager.startLevel(state.levelNumber + 1);
    }
  },
  onGoToMap: () => {
    screenManager.show('map');
  },
  onRefreshLeaderboard: () => {
    void screenManager.renderLeaderboard();
  },
  onResumeGame: () => {
    gameManager.resumeGame();
  }
});

// 5. Initialize Screen Manager with level select hook
screenManager.init((level: number) => {
  void gameManager.startLevel(level);
});

// 6. In-game Pause button
document.getElementById('pz')?.addEventListener('click', () => {
  SoundManager.play('click');
  gameManager.pauseGame();
  Modals.show('mpause');
});

// 7. Register PWA Service Worker for offline play
if ('serviceWorker' in navigator && /^https?:/.test(window.location.protocol)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // SW registration failed in dev/unsupported environment
    });
  });
}

// 8. Boot transition: Loading kitchen splash -> Main Menu
setTimeout(() => {
  screenManager.show('menu');
}, 650);
