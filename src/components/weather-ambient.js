import { LitElement, html } from 'lit';
import { gsap } from 'gsap';

import { startSoftSky } from '../lib/soft-clouds.js';

/**
 * Атмосфера сайта по погоде в Москве.
 *
 * Слой поверх всего, сквозной для мыши. Показывает то, что сейчас за окном,
 * в графике сайта: монохром, тонкие штрихи, ни цвета, ни свечения.
 *
 * Ясно — пусто: чистый холст сам по себе состояние, добавлять к нему нечего.
 *
 * Осадки и разряд идут через canvas — сотни штрихов в DOM обошлись бы дороже,
 * на канвасе это один узел.
 */

class WeatherAmbient extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    condition: { type: String },
  };

  constructor() {
    super();
    this.condition = 'clear';
    this._raf = 0;
    this._particles = [];
    this._flash = null;
    this._onResize = null;
  }

  disconnectedCallback() {
    this._stop();
    super.disconnectedCallback();
  }

  updated(changed) {
    if (changed.has('condition')) this._start();
  }

  _stop() {
    cancelAnimationFrame(this._raf);
    this._raf = 0;
    this._flash?.kill();
    this._flash = null;

    if (this._onResize) {
      window.removeEventListener('resize', this._onResize);
      this._onResize = null;
    }

    this._stopSky?.();
    this._stopSky = null;

    // Гасим канвас: иначе последний кадр осадков остаётся висеть на экране,
    // когда погода сменилась на солнечную.
    const precip = this.querySelector('.wx-precip');
    if (precip) {
      precip.getContext('2d')?.clearRect(0, 0, precip.width, precip.height);
    }
  }

  _start() {
    this._stop();

    const sky = this.querySelector('.wx-sky');
    const precip = this.querySelector('.wx-precip');
    if (!precip || !sky) return;

    if (this.condition === 'cloudy' || this.condition === 'fog') {
      this._stopSky = startSoftSky(sky, this.condition);
    }

    const wet = ['rain', 'snow', 'storm'].includes(this.condition);
    if (wet) this._startPrecipitation(precip);
    if (this.condition === 'storm') this._startLightning();
  }

  /** Дождь — тонкие косые штрихи, снег — мягкие точки. Разница в параметрах. */
  _startPrecipitation(canvas) {
    const snow = this.condition === 'snow';
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
    };
    resize();
    this._onResize = resize;
    window.addEventListener('resize', resize);

    const count = snow ? 90 : 150;
    const w = () => canvas.width;
    const h = () => canvas.height;

    this._particles = Array.from({ length: count }, () => ({
      x: Math.random() * w(),
      y: Math.random() * h(),
      // Снежинки падают медленно и вразнобой, капли — быстро и почти отвесно.
      speed: (snow ? 0.4 + Math.random() * 0.8 : 6 + Math.random() * 6) * dpr,
      drift: (snow ? (Math.random() - 0.5) * 0.6 : -0.8) * dpr,
      size: (snow ? 1 + Math.random() * 1.6 : 6 + Math.random() * 10) * dpr,
      alpha: snow ? 0.18 + Math.random() * 0.22 : 0.1 + Math.random() * 0.16,
      // Снежинку слегка ведёт вбок — отсюда покачивание.
      sway: Math.random() * Math.PI * 2,
    }));

    const ctx = canvas.getContext('2d');

    const draw = () => {
      ctx.clearRect(0, 0, w(), h());

      for (const p of this._particles) {
        if (snow) {
          p.sway += 0.012;
          p.x += Math.sin(p.sway) * 0.6 * dpr + p.drift;
        } else {
          p.x += p.drift;
        }
        p.y += p.speed;

        if (p.y > h()) {
          p.y = -20 * dpr;
          p.x = Math.random() * w();
        }
        if (p.x < -20) p.x = w();
        if (p.x > w() + 20) p.x = 0;

        ctx.globalAlpha = p.alpha;
        if (snow) {
          ctx.fillStyle = '#000';
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.strokeStyle = '#000';
          ctx.lineWidth = dpr;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - p.drift * 6, p.y - p.size);
          ctx.stroke();
        }
      }

      ctx.globalAlpha = 1;
      this._raf = requestAnimationFrame(draw);
    };

    this._raf = requestAnimationFrame(draw);
  }

  /** Молния: короткая вспышка листа и рваный разряд поверх. */
  _startLightning() {
    const flash = this.querySelector('[data-flash]');
    const bolt = this.querySelector('[data-bolt]');
    if (!flash || !bolt) return;

    const strike = () => {
      // Разряд каждый раз новый — ломаная строится заново.
      bolt.setAttribute('d', this._boltPath());

      const tl = gsap.timeline({
        onComplete: () => {
          // Следующий удар через случайную паузу — гроза не метроном.
          this._flash = gsap.delayedCall(5 + Math.random() * 10, strike);
        },
      });

      tl.set([flash, bolt], { opacity: 1 })
        .to([flash, bolt], { opacity: 0, duration: 0.09 })
        .to([flash, bolt], { opacity: 0.85, duration: 0.05 })
        .to([flash, bolt], { opacity: 0, duration: 0.35, ease: 'power2.out' });
    };

    this._flash = gsap.delayedCall(1.5 + Math.random() * 3, strike);
  }

  /** Ломаная сверху вниз со случайными изломами — в координатах 0..100. */
  _boltPath() {
    let x = 15 + Math.random() * 70;
    let y = 0;
    const points = [`M ${x} ${y}`];

    while (y < 100) {
      y += 8 + Math.random() * 12;
      x += (Math.random() - 0.5) * 18;
      points.push(`L ${x.toFixed(1)} ${Math.min(y, 100).toFixed(1)}`);
    }

    return points.join(' ');
  }

  render() {
    const { condition } = this;

    return html`
      <div class="pointer-events-none fixed inset-0 z-40 overflow-hidden">
        ${condition === 'sunny'
          ? html`<div class="wx-sun"></div>`
          : null}

        <!-- Небо: объёмные облака и туман. Низкое разрешение плюс размытие —
             отсюда мягкость, которой от чётких фигур не добиться. -->
        <canvas class="wx-sky absolute inset-0 h-full w-full"></canvas>
        <!-- Осадки: наоборот, чёткие штрихи в полном разрешении. -->
        <canvas class="wx-precip absolute inset-0 h-full w-full"></canvas>

        ${condition === 'storm'
          ? html`
              <div data-flash class="absolute inset-0 bg-white opacity-0"></div>
              <svg
                class="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
              >
                <path
                  data-bolt
                  d=""
                  fill="none"
                  stroke="#000"
                  stroke-width="0.35"
                  vector-effect="non-scaling-stroke"
                  opacity="0"
                />
              </svg>
            `
          : null}
      </div>
    `;
  }
}

customElements.define('weather-ambient', WeatherAmbient);
