import { LitElement, html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { gsap } from 'gsap';

// Ширины колонн из макета (node 86:85). Сумма шире кадра не случайно: полосы
// перекрывают экран с запасом, поэтому наклон не оголяет края.
const COLUMNS = [192, 222, 202, 192, 202, 222, 252, 292, 342, 472];

// Что ждём на самом деле: пока это не загружено, сайт показывать нечем.
const ASSETS = [
  'video/about-1.mp4',
  'video/about-2.mp4',
  'video/about-3.mp4',
];

// Минимальная длительность: загрузка из кеша отрабатывает мгновенно, и экран
// мигал бы впустую. Полторы секунды — чтобы колонны успели выйти по очереди.
const MIN_MS = 1600;

/**
 * Экран загрузки.
 *
 * Вертикальные полосы выходят по мере готовности сайта, и сквозь них идёт одно
 * общее видео: каждая полоса показывает свой кусок кадра, поэтому ролик не
 * распадается на десять независимых — он один, просто разрезан. В центре
 * проценты разностным блендингом: на чёрной полосе цифры белые, на просвете
 * чёрные, своего фона у них нет.
 */
class LoadingScreen extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    percent: { state: true },
    ready: { state: true },
  };

  constructor() {
    super();
    this.percent = 0;
    this.ready = 0;
    this.rootRef = createRef();
    this._videos = [];
  }

  connectedCallback() {
    super.connectedCallback();
    this._start = performance.now();
    this._load();
  }

  disconnectedCallback() {
    clearInterval(this._timer);
    clearTimeout(this._bail);
    super.disconnectedCallback();
  }

  /**
   * Прогресс настоящий: доля загруженных файлов, растянутая до минимальной
   * длительности. Проценты догоняют его плавно — рывок с 0 на 100 читался бы
   * как подделка.
   */
  _load() {
    const total = ASSETS.length;

    ASSETS.forEach((src) => {
      const video = document.createElement('video');
      video.preload = 'auto';
      video.muted = true;
      // Отказ файла тоже считаем готовностью: держать человека на заставке
      // из-за недогруженного ролика нельзя.
      video.addEventListener('error', () => {
        video.dataset.failed = 'true';
      });
      video.src = src;
      this._videos.push(video);
    });

    // Готовность спрашиваем у самих элементов, а не копим по событиям:
    // из кеша ролик бывает готов раньше, чем мы успеваем подписаться, и
    // счётчик навсегда застревал на нуле.
    const loaded = () =>
      this._videos.filter((v) => v.readyState >= 3 || v.dataset.failed).length;

    // Счётчик идёт по меньшему из двух: доле загруженного и выдержанному
    // минимуму. Так он не врёт — но и не прыгает с нуля на сто, когда всё
    // пришло из кеша мгновенно.
    const tick = () => {
      if (this._done) return;
      const elapsed = Math.min(1, (performance.now() - this._start) / MIN_MS);
      const target = Math.min(loaded() / total, elapsed);
      // Догоняем цель, а не прыгаем к ней: цифры идут ровно.
      this._value += (target - this._value) * 0.12;
      this.percent = Math.min(100, Math.round(this._value * 100));
      if (target >= 1 && this.percent >= 99) {
        this.percent = 100;
        clearInterval(this._timer);
        this._finish();
      }
    };
    this._value = 0;
    // Таймер, а не requestAnimationFrame: в свёрнутой или фоновой вкладке кадры
    // не выдаются вовсе, и счётчик навсегда застывал на нуле — человек
    // возвращался к мёртвой заставке.
    this._timer = setInterval(tick, 40);
  }

  _finish() {
    if (this._done) return;
    this._done = true;

    // Полосы расходятся вверх-вниз через одну и уводят за собой заставку:
    // кадр не гаснет, а раскрывается.
    const bars = [...this.querySelectorAll('.loader__col')];

    // Страховка: уход построен на кадрах, а в фоновой вкладке их не выдают —
    // заставка так и осталась бы лежать поверх сайта. По времени снимаем её
    // в любом случае.
    this._bail = setTimeout(() => this.remove(), 2000);
    gsap
      .timeline({ onComplete: () => this.remove() })
      // Полосы уходят через одну вверх и вниз, открывая первый экран. Сам
      // экран уже стоит под ними, поэтому видно не затухание заставки, а то,
      // как сайт проступает в раздвинутые щели.
      .to(bars, {
        yPercent: (i) => (i % 2 ? 118 : -118),
        duration: 1,
        ease: 'power4.inOut',
        stagger: { each: 0.05, from: 'center' },
      })
      .to(this.querySelector('.loader__percent'), { opacity: 0, duration: 0.25 }, 0)
      .to(this.querySelector('.loader'), { backgroundColor: 'rgba(255,255,255,0)', duration: 0.6 }, 0.3);
  }

  render() {
    const total = COLUMNS.reduce((sum, w) => sum + w, 0);
    // Сколько полос уже вышло: ровно по доле прогресса, поэтому кадр
    // закрывается в такт счётчику.
    const shown = Math.ceil((this.percent / 100) * COLUMNS.length);

    return html`
      <div ${ref(this.rootRef)} class="loader">
        <div class="loader__cols">
          ${COLUMNS.map(
            (width, index) => html`
              <div
                class="loader__col"
                data-on=${index < shown ? 'true' : 'false'}
                style="--w: ${(width / total) * 100}%; --i: ${index}"
              >
                <!-- Видео во всю ширину экрана, сдвинутое на место колонны:
                     все полосы показывают один и тот же кадр одного ролика. -->
                <video
                  class="loader__video"
                  src="video/about-1.mp4"
                  autoplay
                  muted
                  loop
                  playsinline
                  preload="auto"
                  style="--shift: ${(COLUMNS.slice(0, index).reduce((s, w) => s + w, 0) / total) * 100}"
                ></video>
              </div>
            `,
          )}
        </div>

        <span class="loader__percent">${this.percent}%</span>
      </div>
    `;
  }
}

customElements.define('loading-screen', LoadingScreen);
