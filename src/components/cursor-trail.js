import { LitElement, html } from 'lit';
import { gsap } from 'gsap';

/**
 * Шлейф из портретов за курсором.
 *
 * Кадры роняются не по таймеру, а по пройденному расстоянию: ведёшь мышь
 * быстро — портреты ложатся чаще, стоишь на месте — ничего не появляется.
 * Так шлейф повторяет жест, а не тикает сам по себе.
 *
 * Только для мыши: на тач-устройствах курсора нет, и вешать это на палец
 * бессмысленно.
 */

// Vite соберёт все кадры и подставит готовые пути.
const FACES = Object.values(
  import.meta.glob('../assets/cursor/*.png', {
    eager: true,
    query: '?url',
    import: 'default',
  }),
);

const STEP = 190; // через сколько пикселей пути ронять следующий кадр
const LIMIT = 8; // больше живых кадров на экране не держим

class CursorTrail extends LitElement {
  createRenderRoot() {
    return this;
  }

  constructor() {
    super();
    this._index = 0;
    this._lastX = null;
    this._lastY = null;
    this._alive = [];
  }

  connectedCallback() {
    super.connectedCallback();

    // Тонкий указатель — значит мышь или трекпад.
    this._enabled =
      window.matchMedia('(pointer: fine)').matches &&
      !window.matchMedia('(prefers-reduced-motion: reduce)').matches &&
      FACES.length > 0;

    if (!this._enabled) return;

    this._onMove = (event) => this._onPointerMove(event);
    window.addEventListener('pointermove', this._onMove, { passive: true });
  }

  disconnectedCallback() {
    window.removeEventListener('pointermove', this._onMove);
    this._alive.forEach((node) => node.remove());
    this._alive = [];
    super.disconnectedCallback();
  }

  _onPointerMove(event) {
    const { clientX: x, clientY: y } = event;

    if (this._lastX === null) {
      this._lastX = x;
      this._lastY = y;
      return;
    }

    const distance = Math.hypot(x - this._lastX, y - this._lastY);
    if (distance < STEP) return;

    this._lastX = x;
    this._lastY = y;
    this._drop(x, y);
  }

  _drop(x, y) {
    const image = document.createElement('img');
    image.src = FACES[this._index % FACES.length];
    image.alt = '';
    image.className = 'cursor-trail__face';
    this._index++;

    // Лёгкий разброс, чтобы шлейф не выглядел печатью под линейку.
    const tilt = (Math.random() - 0.5) * 26;
    const size = 54 + Math.random() * 20;

    image.style.width = `${size}px`;
    image.style.left = `${x}px`;
    image.style.top = `${y}px`;

    this.firstElementChild.append(image);
    this._alive.push(image);

    // Старые кадры убираем сразу, чтобы в DOM не копился хвост.
    while (this._alive.length > LIMIT) {
      this._alive.shift()?.remove();
    }

    gsap.fromTo(
      image,
      { opacity: 0, scale: 0.7, rotate: tilt - 8, xPercent: -50, yPercent: -50 },
      { opacity: 1, scale: 1, rotate: tilt, duration: 0.18, ease: 'power2.out' },
    );

    gsap.to(image, {
      opacity: 0,
      scale: 0.82,
      duration: 0.75,
      delay: 0.32,
      ease: 'power2.in',
      onComplete: () => {
        image.remove();
        this._alive = this._alive.filter((node) => node !== image);
      },
    });
  }

  render() {
    return html`<div class="pointer-events-none fixed inset-0 z-50 overflow-hidden"></div>`;
  }
}

customElements.define('cursor-trail', CursorTrail);
