export class ParticleFx {
  /**
   * Spawns a floating score number over a grid cell
   */
  public static floatAt(boardEl: HTMLElement, row: number, col: number, cellSize: number, text: string): void {
    const el = document.createElement('div');
    el.className = 'fl-score';
    el.textContent = text;
    el.style.left = `${(col + 0.5) * cellSize}px`;
    el.style.top = `${(row + 0.2) * cellSize}px`;
    boardEl.appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  /**
   * Spawns an animated banner notification across the board
   */
  public static banner(container: HTMLElement, text: string): void {
    const el = document.createElement('div');
    el.className = 'big-banner';
    el.textContent = text;
    container.appendChild(el);
    setTimeout(() => el.remove(), 1100);
  }

  /**
   * Shakes the board for impactful explosions
   */
  public static shake(boardEl: HTMLElement): void {
    boardEl.classList.remove('shake');
    // Force reflow
    void boardEl.offsetWidth;
    boardEl.classList.add('shake');
    setTimeout(() => boardEl.classList.remove('shake'), 250);
  }

  /**
   * Spawns a shower of colorful celebration confetti for victory celebrations
   */
  public static launchConfetti(container: HTMLElement = document.body): void {
    const colors = ['#ffc93c', '#f77f00', '#d62828', '#2a9d8f', '#e76f51', '#fff4dc', '#00b4d8'];
    for (let i = 0; i < 48; i++) {
      const piece = document.createElement('div');
      piece.className = 'confetti-piece';
      piece.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      piece.style.left = `${Math.random() * 100}%`;
      piece.style.animationDelay = `${Math.random() * 0.4}s`;
      piece.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      piece.style.transform = `rotate(${Math.random() * 360}deg)`;
      container.appendChild(piece);
      setTimeout(() => piece.remove(), 3200);
    }
  }
}
