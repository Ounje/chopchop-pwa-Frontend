import { FOODS, SPECIAL_ASSETS, getFoodIconHtml } from '../config/foods.js';
import { Tile, SpecialType, LevelConfig } from '../types/index.js';
import { SoundManager } from '../audio/SoundManager.js';
import { ParticleFx } from '../ui/ParticleFx.js';

const N = 8; // 8x8 Grid
const cellKey = (r: number, c: number) => r * N + c;
const rnd = (k: number) => Math.floor(Math.random() * k);

export interface RunGroup {
  d: 'h' | 'v';
  t: number;
  cells: number[];
}

export interface MatchGroup {
  t: number;
  cells: Set<number>;
  runs: RunGroup[];
}

export interface BoardEngineCallbacks {
  onScoreGain: (points: number, combo: number) => void;
  onObjectiveProgress: (foodKey: string, count: number) => void;
  onMoveSpent: () => void;
  onChickenMatched: (count: number) => void;
  onBombCreated: (count: number) => void;
  onComboAchieved: (combo: number) => void;
  onCheckGameEnd: () => void;
}

export class BoardEngine {
  private boardEl: HTMLElement;
  private grid: Array<Array<Tile | null>> = [];
  private cellSize = 40;
  private uid = 0;
  private selectedTile: Tile | null = null;
  private dragOrigin: { x: number; y: number; r: number; c: number } | null = null;
  private isBusy = false;
  private levelCfg!: LevelConfig;
  private callbacks!: BoardEngineCallbacks;
  private activeFoodIndices: number[] = [];
  private preferredSpawnKeys: number[] | null = null;

  constructor(boardEl: HTMLElement) {
    this.boardEl = boardEl;
    this.setupEventListeners();
  }

  private setupActiveFoodPool(levelCfg: LevelConfig): void {
    const pool: number[] = [];

    // 1. Mandatory: include ALL objective food items so requirements always spawn on board
    if (levelCfg.objectives && levelCfg.objectives.length > 0) {
      for (const obj of levelCfg.objectives) {
        const idx = FOODS.findIndex(f => f.k === obj.food);
        if (idx !== -1 && !pool.includes(idx)) {
          pool.push(idx);
        }
      }
    }

    // 2. Fill remaining slots up to levelCfg.kinds with other foods
    const targetCount = Math.max(levelCfg.kinds || 4, pool.length);
    for (let i = 0; i < FOODS.length && pool.length < targetCount; i++) {
      if (!pool.includes(i)) {
        pool.push(i);
      }
    }

    this.activeFoodIndices = pool;
  }

  private getRandomFoodIndex(): number {
    if (!this.activeFoodIndices || this.activeFoodIndices.length === 0) {
      return rnd(Math.min(this.levelCfg?.kinds || 4, FOODS.length));
    }
    return this.activeFoodIndices[rnd(this.activeFoodIndices.length)];
  }

  public init(levelCfg: LevelConfig, callbacks: BoardEngineCallbacks): void {
    this.levelCfg = levelCfg;
    this.callbacks = callbacks;
    this.isBusy = false;
    this.selectedTile = null;
    this.dragOrigin = null;
    this.setupActiveFoodPool(levelCfg);
    this.updateLayout();
    this.buildNewBoard();
  }

  public setBusy(busy: boolean): void {
    this.isBusy = busy;
  }

  public isEngineBusy(): boolean {
    return this.isBusy;
  }

  public updateLayout(): void {
    const parentW = Math.min(window.innerWidth - 16, 560);
    const parentH = window.innerHeight - 190;
    this.cellSize = Math.floor(Math.min(parentW - 6, parentH - 6) / N);

    this.boardEl.style.width = `${this.cellSize * N + 6}px`;
    this.boardEl.style.height = `${this.cellSize * N + 6}px`;
    this.boardEl.style.backgroundSize = `${this.cellSize * 2}px ${this.cellSize * 2}px`;

    // Recalculate tile sizes and positions
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = this.grid[r]?.[c];
        if (p && p.el) {
          p.el.style.width = `${this.cellSize}px`;
          p.el.style.height = `${this.cellSize}px`;
          this.setTilePositionStyle(p);
        }
      }
    }
  }

  private createTile(t: number, s: SpecialType | null = null): Tile {
    return {
      id: ++this.uid,
      t,
      s,
      r: 0,
      c: 0,
      el: null
    };
  }

  private getTileHtml(p: Tile): string {
    if (p.s) {
      const asset = SPECIAL_ASSETS[p.s];
      return `<img src="${asset}" alt="${p.s}" draggable="false">`;
    }
    return getFoodIconHtml(FOODS[p.t]);
  }

  private setTilePositionStyle(p: Tile): void {
    if (!p.el) return;
    const x = p.c * this.cellSize;
    const y = p.r * this.cellSize;
    p.el.style.setProperty('--t', `translate(${x}px, ${y}px)`);
    p.el.style.transform = `translate(${x}px, ${y}px)`;
  }

  private placeTile(p: Tile, r: number, c: number, fromRow?: number): void {
    p.r = r;
    p.c = c;
    this.grid[r][c] = p;

    if (!p.el) {
      const el = document.createElement('div');
      el.className = `p ${p.s ? p.s : ''}`;
      el.style.width = `${this.cellSize}px`;
      el.style.height = `${this.cellSize}px`;
      el.innerHTML = this.getTileHtml(p);
      p.el = el;
      this.boardEl.appendChild(el);

      if (fromRow !== undefined) {
        el.style.transition = 'none';
        el.style.transform = `translate(${c * this.cellSize}px, ${fromRow * this.cellSize}px)`;
        // trigger reflow
        void el.offsetWidth;
        el.style.transition = '';
      }
    }

    this.setTilePositionStyle(p);
  }

  private makeTileSpecial(p: Tile, s: SpecialType): void {
    p.s = s;
    p.t = -1;
    if (p.el) {
      p.el.className = `p born ${s}`;
      p.el.innerHTML = this.getTileHtml(p);
    }
  }

  public buildNewBoard(): void {
    this.boardEl.innerHTML = '';
    this.grid = Array.from({ length: N }, () => Array(N).fill(null));

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        let t = 0;
        let attempts = 0;
        do {
          t = this.getRandomFoodIndex();
          attempts++;
        } while (
          attempts < 30 &&
          ((c > 1 && this.grid[r][c - 1]?.t === t && this.grid[r][c - 2]?.t === t) ||
            (r > 1 && this.grid[r - 1][c]?.t === t && this.grid[r - 2][c]?.t === t))
        );

        const tile = this.createTile(t);
        this.placeTile(tile, r, c);
      }
    }

    if (!this.hasAvailableMove()) {
      this.buildNewBoard();
    }
  }

  private getMatchingGroups(): MatchGroup[] {
    const runs: RunGroup[] = [];

    // Horizontal matches
    for (let r = 0; r < N; r++) {
      let c = 0;
      while (c < N) {
        const t = this.grid[r][c] ? this.grid[r][c]!.t : -1;
        let e = c;
        while (e < N && this.grid[r][e] && this.grid[r][e]!.t === t) {
          e++;
        }
        if (t >= 0 && e - c >= 3) {
          runs.push({
            d: 'h',
            t,
            cells: Array.from({ length: e - c }, (_, i) => cellKey(r, c + i))
          });
        }
        c = e > c ? e : c + 1;
      }
    }

    // Vertical matches
    for (let c = 0; c < N; c++) {
      let r = 0;
      while (r < N) {
        const t = this.grid[r][c] ? this.grid[r][c]!.t : -1;
        let e = r;
        while (e < N && this.grid[e][c] && this.grid[e][c]!.t === t) {
          e++;
        }
        if (t >= 0 && e - r >= 3) {
          runs.push({
            d: 'v',
            t,
            cells: Array.from({ length: e - r }, (_, i) => cellKey(r + i, c))
          });
        }
        r = e > r ? e : r + 1;
      }
    }

    // Merge intersecting runs
    const groups: MatchGroup[] = [];
    runs.forEach(run => {
      const hit = groups.filter(x => x.t === run.t && run.cells.some(k => x.cells.has(k)));
      let target = hit[0];
      if (!target) {
        target = { t: run.t, cells: new Set(), runs: [] };
        groups.push(target);
      }

      hit.slice(1).forEach(other => {
        other.cells.forEach(k => target.cells.add(k));
        target.runs.push(...other.runs);
        groups.splice(groups.indexOf(other), 1);
      });

      run.cells.forEach(k => target.cells.add(k));
      target.runs.push(run);
    });

    return groups;
  }

  public hasAvailableMove(): boolean {
    // Check if any special pieces exist that can be tapped/swapped
    for (const row of this.grid) {
      for (const p of row) {
        if (p && (p.s === 'c' || p.s === 'b')) return true;
      }
    }

    // Check all adjacent swaps
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const r2 = r + dr;
          const c2 = c + dc;
          if (r2 >= N || c2 >= N) continue;

          const a = this.grid[r][c];
          const b = this.grid[r2][c2];
          if (!a || !b) continue;

          if (a.s || b.s) return true;

          // Tentative swap
          this.grid[r][c] = b;
          this.grid[r2][c2] = a;
          const valid = this.getMatchingGroups().length > 0;
          this.grid[r][c] = a;
          this.grid[r2][c2] = b;

          if (valid) return true;
        }
      }
    }
    return false;
  }

  private expandSpecialTriggers(cellSet: Set<number>): number {
    const queue = [...cellSet];
    const processed = new Set<number>();
    let specialsTriggered = 0;

    const addCell = (r: number, c: number) => {
      if (r < 0 || c < 0 || r >= N || c >= N || !this.grid[r][c]) return;
      const k = cellKey(r, c);
      if (!cellSet.has(k)) {
        cellSet.add(k);
        queue.push(k);
      }
    };

    while (queue.length > 0) {
      const k = queue.pop()!;
      if (processed.has(k)) continue;
      processed.add(k);

      const r = Math.floor(k / N);
      const c = k % N;
      const p = this.grid[r][c];
      if (!p || !p.s) continue;

      specialsTriggered++;

      if (p.s === 'h') {
        for (let i = 0; i < N; i++) addCell(r, i);
      } else if (p.s === 'v') {
        for (let i = 0; i < N; i++) addCell(i, c);
      } else if (p.s === 'c') {
        const targetType = p.target !== undefined ? p.target : (() => {
          const normalTiles = this.grid.flat().filter(x => x && x.t >= 0);
          return normalTiles.length ? normalTiles[rnd(normalTiles.length)]!.t : this.getRandomFoodIndex();
        })();
        this.grid.flat().forEach(x => {
          if (x && x.t === targetType) addCell(x.r, x.c);
        });
      } else if (p.s === 'b') {
        for (let i = -2; i <= 2; i++) {
          for (let j = -2; j <= 2; j++) {
            addCell(r + i, c + j);
          }
        }
      }

      SoundManager.play(p.s === 'b' ? 'boom' : 'cut');
      if (p.s === 'b') {
        ParticleFx.shake(this.boardEl);
      }
    }

    return specialsTriggered;
  }

  private async clearSet(cellSet: Set<number>, spawns: Array<{ k: number; s: SpecialType }>, points: number, combo: number): Promise<void> {
    const keys = [...cellSet];
    const gained = Math.round(points * combo);
    this.callbacks.onScoreGain(gained, combo);

    keys.forEach(k => {
      const r = Math.floor(k / N);
      const c = k % N;
      const p = this.grid[r][c];
      if (!p) return;

      p.el?.classList.add('pop');

      if (p.t >= 0) {
        const food = FOODS[p.t];
        this.callbacks.onObjectiveProgress(food.k, 1);
        if (food.k === 'chicken') {
          this.callbacks.onChickenMatched(1);
        }
      }
    });

    if (keys.length > 0) {
      const firstKey = keys[0];
      const r = Math.floor(firstKey / N);
      const c = firstKey % N;
      ParticleFx.floatAt(this.boardEl, r, c, this.cellSize, `+${gained}`);
    }

    if (combo >= 2) {
      ParticleFx.banner(this.boardEl, `COMBO x${combo}`);
      SoundManager.play('combo');
      this.callbacks.onComboAchieved(combo);
    } else {
      SoundManager.play('match');
    }

    await this.delay(230);

    // Remove DOM elements and clean grid
    keys.forEach(k => {
      const r = Math.floor(k / N);
      const c = k % N;
      const p = this.grid[r][c];
      if (p) {
        p.el?.remove();
        this.grid[r][c] = null;
      }
    });

    // Spawn created specials
    spawns.forEach(s => {
      const r = Math.floor(s.k / N);
      const c = s.k % N;
      const p = this.createTile(-1, s.s);
      this.placeTile(p, r, c);
      this.makeTileSpecial(p, s.s);
      if (s.s === 'b') {
        this.callbacks.onBombCreated(1);
      }
      SoundManager.play('make');
    });

    await this.applyGravity();
  }

  private async applyGravity(): Promise<void> {
    for (let c = 0; c < N; c++) {
      let writeRow = N - 1;
      for (let r = N - 1; r >= 0; r--) {
        if (this.grid[r][c]) {
          const p = this.grid[r][c]!;
          if (writeRow !== r) {
            this.grid[r][c] = null;
            this.placeTile(p, writeRow, c);
          }
          writeRow--;
        }
      }

      // Fill top empty spaces with newly spawned tiles
      for (let r = writeRow; r >= 0; r--) {
        const p = this.createTile(this.getRandomFoodIndex());
        this.placeTile(p, r, c, r - (writeRow + 1) - 1);
      }
    }

    await this.delay(260);
  }

  private async cascadeLoop(initialCombo: number): Promise<number> {
    let combo = initialCombo;

    while (true) {
      const matchGroups = this.getMatchingGroups();
      if (!matchGroups.length) break;

      const cellSet = new Set<number>();
      const spawns: Array<{ k: number; s: SpecialType }> = [];
      let points = 0;

      for (const group of matchGroups) {
        const size = group.cells.size;
        const hasBothDir = group.runs.some(r => r.d === 'h') && group.runs.some(r => r.d === 'v');
        const longestRun = group.runs.reduce((a, b) => b.cells.length > a.cells.length ? b : a);
        const longestLen = longestRun.cells.length;

        points += size >= 6 ? 1000 : size === 5 ? 500 : size === 4 ? 250 : 100;
        group.cells.forEach(k => cellSet.add(k));

        let createdSpecial: SpecialType | null = null;
        if (longestLen >= 6) {
          createdSpecial = 'b';
        } else if (hasBothDir || longestLen === 5) {
          createdSpecial = 'c';
        } else if (longestLen === 4) {
          createdSpecial = longestRun.d === 'h' ? 'h' : 'v';
        }

        if (createdSpecial) {
          let spawnKey = [...group.cells].find(k => this.preferredSpawnKeys && this.preferredSpawnKeys.includes(k));
          if (spawnKey === undefined) {
            spawnKey = longestRun.cells[longestRun.cells.length >> 1];
          }
          spawns.push({ k: spawnKey, s: createdSpecial });
        }
      }

      const specialsCount = this.expandSpecialTriggers(cellSet);
      points += specialsCount * 300 + (cellSet.size > matchGroups.reduce((acc, g) => acc + g.cells.size, 0) ? 30 * cellSet.size : 0);

      this.preferredSpawnKeys = null;
      await this.clearSet(cellSet, spawns, points, combo);
      combo++;
    }

    return combo;
  }

  private getSpecialCombinationSet(pa: Tile, pb: Tile): Set<number> {
    const s = new Set<number>([cellKey(pa.r, pa.c), cellKey(pb.r, pb.c)]);
    const a = pa.s;
    const b = pb.s;

    const addRow = (r: number) => {
      if (r >= 0 && r < N) {
        for (let i = 0; i < N; i++) s.add(cellKey(r, i));
      }
    };

    const addCol = (c: number) => {
      if (c >= 0 && c < N) {
        for (let i = 0; i < N; i++) s.add(cellKey(i, c));
      }
    };

    const addAll = () => {
      for (let i = 0; i < N * N; i++) s.add(i);
    };

    if (a && b) {
      const hasChef = a === 'c' || b === 'c';
      const hasBomb = a === 'b' || b === 'b';

      if (hasChef && (hasBomb || a === b)) {
        addAll();
      } else if (hasBomb) {
        const bombTile = a === 'b' ? pa : pb;
        for (let d = -1; d <= 1; d++) {
          addRow(bombTile.r + d);
          addCol(bombTile.c + d);
        }
      } else if (hasChef) {
        const pool = this.grid.flat().filter(x => x && x.t >= 0);
        const targetType = pool.length ? pool[rnd(pool.length)]!.t : 0;
        this.grid.flat().forEach(x => {
          if (x && x.t === targetType) s.add(cellKey(x.r, x.c));
        });
        addRow(pa.r);
        addCol(pa.c);
        addRow(pb.r);
        addCol(pb.c);
        ParticleFx.banner(this.boardEl, 'CHEF CUT!');
      } else {
        addRow(pa.r);
        addCol(pa.c);
        addRow(pb.r);
        addCol(pb.c);
      }
    } else if (a === 'c' || b === 'c') {
      const chef = a === 'c' ? pa : pb;
      const other = a === 'c' ? pb : pa;
      chef.target = other.t;
    }

    return s;
  }

  public async executeMove(a: { r: number; c: number }, b: { r: number; c: number }): Promise<void> {
    if (this.isBusy) return;
    this.isBusy = true;
    this.unselect();

    const pa = this.grid[a.r][a.c]!;
    const pb = this.grid[b.r][b.c]!;

    // Perform swap
    const swapPieces = () => {
      const tempA = this.grid[a.r][a.c]!;
      const tempB = this.grid[b.r][b.c]!;
      this.placeTile(tempB, a.r, a.c);
      this.placeTile(tempA, b.r, b.c);
    };

    swapPieces();
    SoundManager.play('swap');
    await this.delay(190);

    const isSpecialSwap = Boolean(pa.s || pb.s);

    if (isSpecialSwap) {
      this.callbacks.onMoveSpent();
      const affectedSet = this.getSpecialCombinationSet(pa, pb);
      const specialsTriggered = this.expandSpecialTriggers(affectedSet);

      if (pa.s === 'c' && pa.target !== undefined) {
        this.grid.flat().forEach(x => {
          if (x && x.t === pa.target) affectedSet.add(cellKey(x.r, x.c));
        });
      }
      if (pb.s === 'c' && pb.target !== undefined) {
        this.grid.flat().forEach(x => {
          if (x && x.t === pb.target) affectedSet.add(cellKey(x.r, x.c));
        });
      }
      this.expandSpecialTriggers(affectedSet);

      const points = affectedSet.size * 30 + specialsTriggered * 300 + (affectedSet.size >= 48 ? 3000 : 0);
      await this.clearSet(affectedSet, [], points, 1);
      await this.cascadeLoop(2);
    } else if (this.getMatchingGroups().length === 0) {
      // Invalid move: shake and revert
      SoundManager.play('bad');
      swapPieces();
      pa.el?.classList.add('shake');
      pb.el?.classList.add('shake');
      await this.delay(200);
      pa.el?.classList.remove('shake');
      pb.el?.classList.remove('shake');
      this.isBusy = false;
      return;
    } else {
      this.callbacks.onMoveSpent();
      this.preferredSpawnKeys = [cellKey(a.r, a.c), cellKey(b.r, b.c)];
      await this.cascadeLoop(1);
    }

    this.callbacks.onCheckGameEnd();

    // Check if deadlocked and reshuffle
    let reshuffleAttempts = 0;
    while (!this.hasAvailableMove() && reshuffleAttempts++ < 40) {
      ParticleFx.banner(this.boardEl, 'SHUFFLING...');
      await this.reshuffleBoard();
    }

    this.isBusy = false;
  }

  private async reshuffleBoard(): Promise<void> {
    const tiles = this.grid.flat();
    let valid = false;
    let attempts = 0;

    while (!valid && attempts++ < 60) {
      const shuffled = tiles.slice().sort(() => Math.random() - 0.5);
      let idx = 0;
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          this.grid[r][c] = shuffled[idx++];
        }
      }
      valid = this.getMatchingGroups().length === 0 && this.hasAvailableMove();
    }

    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = this.grid[r][c]!;
        p.r = r;
        p.c = c;
        this.setTilePositionStyle(p);
      }
    }

    SoundManager.play('swap');
    await this.delay(300);
  }

  public unselect(): void {
    if (this.selectedTile && this.selectedTile.el) {
      this.selectedTile.el.classList.remove('sel');
      this.selectedTile = null;
    }
  }

  private getCellFromPointer(e: PointerEvent): { r: number; c: number } | null {
    const rect = this.boardEl.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left - 3) / this.cellSize);
    const r = Math.floor((e.clientY - rect.top - 3) / this.cellSize);
    return r >= 0 && c >= 0 && r < N && c < N ? { r, c } : null;
  }

  private areAdjacent(a: { r: number; c: number }, b: { r: number; c: number }): boolean {
    return Math.abs(a.r - b.r) + Math.abs(a.c - b.c) === 1;
  }

  private setupEventListeners(): void {
    this.boardEl.addEventListener('pointerdown', (e: PointerEvent) => {
      if (this.isBusy) return;
      const cell = this.getCellFromPointer(e);
      if (!cell) return;

      SoundManager.play('tap');

      if (this.selectedTile && this.areAdjacent(this.selectedTile, cell)) {
        const origin = { r: this.selectedTile.r, c: this.selectedTile.c };
        this.dragOrigin = null;
        void this.executeMove(origin, cell);
        return;
      }

      if (this.selectedTile && this.selectedTile.r === cell.r && this.selectedTile.c === cell.c) {
        this.unselect();
        return;
      }

      this.unselect();
      this.selectedTile = this.grid[cell.r][cell.c];
      if (this.selectedTile && this.selectedTile.el) {
        this.selectedTile.el.classList.add('sel');
      }

      this.dragOrigin = { x: e.clientX, y: e.clientY, r: cell.r, c: cell.c };
    });

    this.boardEl.addEventListener('pointermove', (e: PointerEvent) => {
      if (!this.dragOrigin || this.isBusy) return;

      const dx = e.clientX - this.dragOrigin.x;
      const dy = e.clientY - this.dragOrigin.y;
      const threshold = this.cellSize * 0.45;

      if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) return;

      const from = { r: this.dragOrigin.r, c: this.dragOrigin.c };
      const to = Math.abs(dx) > Math.abs(dy)
        ? { r: from.r, c: from.c + Math.sign(dx) }
        : { r: from.r + Math.sign(dy), c: from.c };

      this.dragOrigin = null;

      if (to.r >= 0 && to.c >= 0 && to.r < N && to.c < N) {
        void this.executeMove(from, to);
      }
    });

    window.addEventListener('pointerup', () => {
      this.dragOrigin = null;
    });

    window.addEventListener('resize', () => {
      this.updateLayout();
    });
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
