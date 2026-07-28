/**
 * Физика бумаги.
 *
 * Лист — не камень: он почти сразу выходит на малую предельную скорость и
 * планирует, раскачиваясь из стороны в сторону. Поэтому здесь квадратичное
 * сопротивление воздуха плюс «трепет» — колебание боковой скорости и наклона,
 * связанные между собой (лист поворачивается туда, куда его сносит).
 */

import { gsap } from 'gsap';

const GRAVITY = 2000; // px/s²

/**
 * Маятник надорванного листа.
 *
 * Пока лента цела, лист держится всей верхней кромкой. По мере разрыва опора
 * укорачивается, и лист начинает висеть на остатке — кренится под собственным
 * весом и раскачивается от рывков. Это обычный маятник с затуханием: угол
 * тянется к равновесию, рывок за хлястик добавляет импульс.
 */
export class SheetPendulum {
  /**
   * @param {HTMLElement} el
   * @param {{stiffness?: number, damping?: number}} opts
   */
  constructor(el, { stiffness = 95, damping = 8.5 } = {}) {
    this.el = el;
    this.stiffness = stiffness;
    this.damping = damping;

    this.angle = 0;
    this.velocity = 0;
    this.target = 0;
    this.origin = '50% 0%';

    this._tick = this._tick.bind(this);
    this._running = false;
  }

  /** Точка подвеса — середина ещё не оторванного участка кромки. */
  setOrigin(origin) {
    this.origin = origin;
  }

  /** Равновесный угол: чем меньше осталось опоры, тем сильнее кренится. */
  setTarget(angle) {
    this.target = angle;
    this._start();
  }

  /** Рывок за хлястик раскачивает лист. */
  impulse(force) {
    this.velocity += force;
    this._start();
  }

  _start() {
    if (this._running) return;
    this._running = true;
    gsap.ticker.add(this._tick);
  }

  _tick(_time, deltaMs) {
    const dt = Math.min(deltaMs, 34) / 1000;

    const accel =
      -this.stiffness * (this.angle - this.target) - this.damping * this.velocity;
    this.velocity += accel * dt;
    this.angle += this.velocity * dt;

    gsap.set(this.el, { transformOrigin: this.origin, rotation: this.angle });

    // Успокоился в равновесии — снимаемся с тикера.
    if (Math.abs(this.angle - this.target) < 0.02 && Math.abs(this.velocity) < 0.02) {
      this.angle = this.target;
      this.velocity = 0;
      gsap.set(this.el, { transformOrigin: this.origin, rotation: this.angle });
      this.stop();
    }
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    gsap.ticker.remove(this._tick);
  }
}

/**
 * Свободное падение куска бумаги с планированием.
 *
 * @param {HTMLElement} el
 * @param {object} opts
 * @param {number} [opts.vx] начальная горизонтальная скорость, px/s
 * @param {number} [opts.vy] начальная вертикальная скорость, px/s (минус — вверх)
 * @param {number} [opts.spin] начальная угловая скорость, °/s
 * @param {number} [opts.drag] коэффициент сопротивления: больше — медленнее падает.
 *   Предельная скорость ≈ sqrt(GRAVITY / 60 / drag) px/с, т.е. 0.00009 ≈ 600 px/с —
 *   примерно так планирует лист А4.
 * @param {number} [opts.flutter] амплитуда раскачки
 * @param {number} [opts.startX] стартовое смещение по x (если элемент уже сдвинут)
 * @param {number} [opts.startRotation] стартовый угол
 * @param {() => void} [opts.onDone] вызывается, когда лист ушёл за нижний край
 * @returns {() => void} отмена
 */
export function dropPaper(
  el,
  {
    vx = 0,
    vy = 0,
    spin = 0,
    drag = 0.00009,
    flutter = 1,
    startX = 0,
    startRotation = 0,
    // Общая фаза позволяет пустить несколько элементов как один кусок бумаги:
    // они будут раскачиваться синхронно, а не разъезжаться.
    startPhase = Math.random() * Math.PI * 2,
    onDone,
  } = {},
) {
  let x = startX;
  let y = 0;
  let rotation = startRotation;
  let phase = startPhase;
  let elapsed = 0;

  const startBottom = el.getBoundingClientRect().top;
  const fallDistance = window.innerHeight - startBottom + el.offsetHeight + 80;

  function tick(_time, deltaMs) {
    const dt = Math.min(deltaMs, 34) / 1000;
    elapsed += dt;

    // Квадратичное сопротивление по обеим осям — отсюда предельная скорость.
    const speed = Math.hypot(vx, vy) || 1;
    vx -= drag * vx * speed * dt * 60;
    vy -= drag * vy * speed * dt * 60;
    vy += GRAVITY * dt;

    // Трепет: лист рыскает вбок и одновременно кренится в ту же сторону.
    phase += dt * (3.2 + flutter);
    const sway = Math.sin(phase) * 110 * flutter;
    vx += sway * dt;

    x += vx * dt;
    y += vy * dt;
    rotation += spin * dt + Math.cos(phase) * 26 * flutter * dt;
    spin *= 1 - 0.6 * dt; // вращение тоже гасится воздухом

    gsap.set(el, { x, y, rotation });

    if (y > fallDistance || elapsed > 6) {
      cancel();
      onDone?.();
    }
  }

  gsap.ticker.add(tick);

  function cancel() {
    gsap.ticker.remove(tick);
  }

  return cancel;
}
