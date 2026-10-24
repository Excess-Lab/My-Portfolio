import { LitElement, html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';
import { InertiaPlugin } from 'gsap/InertiaPlugin';

import { LOCALES, getLang, setLang, t, onLanguageChange } from '../i18n/index.js';
import { CASES, CATEGORIES, isVideo } from '../data/cases.js';

gsap.registerPlugin(Draggable, InertiaPlugin);

// Геометрия ленты. Всё в долях ширины колонки, поэтому на телефоне барабан
// просто становится меньше, а не разъезжается.
const CARD_H = 0.62;
// Шаг по дуге много меньше карточки: как в макете, каждая следующая закрывает
// предыдущую почти целиком, и от дальних остаётся только узкая полоса.
const STEP = CARD_H * 0.42;
// Радиус барабана в высотах карточки и глубина перспективы в радиусах. Вдвоём
// они и решают, насколько круто карточки заваливаются к краям.
const RADIUS = 1.45;
const DEPTH = 1.15;
// Дальше этого угла карточка уже смотрит ребром — её незачем показывать.
const EDGE = 1.45;

// Скорость самохода: в макете лента проезжает 4346px за 30 секунд.
const AUTO = 4346 / 30 / 732;

// Насколько карточка выходит вперёд под курсором (в высотах карточки) и
// насколько при этом выпрямляется.
const LIFT = 0.42;
const STRAIGHTEN = 0.55;

// Нижняя строка макета. ready — раздел, который уже есть на сайте: остальные
// подписи стоят неактивными, чтобы строка совпадала с макетом целиком.
const LINKS = [
  { key: 'cases', label: 'cases', current: true, ready: true },
  { key: 'products', label: 'homeProducts', ready: false },
  { key: 'gallery', label: 'homePhotos', ready: false },
  { key: 'archive', label: 'homeGraveyard', ready: false },
];

class HomeScreen extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    lang: { state: true },
    copies: { state: true },
  };

  constructor() {
    super();
    this.lang = getLang();
    // Сколько раз повторён набор кейсов. Считаем до первой отрисовки: Lit
    // ругается, когда состояние меняют уже после неё.
    this.copies = HomeScreen.fitCopies();
    this._rail = createRef();
    this._track = createRef();
    // Позиция ленты в пикселях. Всё движение — драг, колесо, самоход —
    // сводится к ней, поэтому источник правды один и швов на стыке нет.
    this._y = 0;
    // Скорость от колеса: гасится трением, поэтому бросок колесом докатывается,
    // а не останавливается в тот же кадр.
    this._spin = 0;
    this._held = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._offLang = onLanguageChange(() => {
      this.lang = getLang();
    });
    this._onResize = () => {
      this.copies = HomeScreen.fitCopies();
      this._measure();
    };
    window.addEventListener('resize', this._onResize);
  }

  disconnectedCallback() {
    this._offLang?.();
    window.removeEventListener('resize', this._onResize);
    gsap.ticker.remove(this._tick);
    this._drag?.kill();
    super.disconnectedCallback();
  }

  firstUpdated() {
    this._measure();
    this._setupDrag();

    this._tick = (time, delta) => this._advance(delta / 1000);
    gsap.ticker.add(this._tick);
  }

  /** Копий стало больше или меньше — заново берём карточки и размеры. */
  updated() {
    this._measure();
  }

  /**
   * Пересчёт размеров. Ширина карточки задана в CSS (она ужимается под окно),
   * поэтому читаем её с рельса, а не считаем сами: одна точка правды на вёрстку
   * и на физику ленты.
   */
  _measure() {
    const rail = this._rail.value;
    if (!rail) return;

    this._width = rail.clientWidth;
    this._height = rail.clientHeight;
    this._step = this._width * STEP;
    this._card = this._width * CARD_H;
    this._radius = this._card * RADIUS;
    // Перспектива — доля радиуса, поэтому крутизна завала одна и та же на любом
    // экране: меняется размер барабана, а не его характер.
    rail.style.perspective = `${(this._radius * DEPTH).toFixed(1)}px`;
    // Ось барабана отодвинута назад на радиус: центральная карточка выходит
    // в плоскость экрана и видна в натуральную величину, а не раздутой.
    this._track.value.style.transform = `translateZ(${-this._radius.toFixed(1)}px)`;
    // Период цикла: сдвиг на весь набор возвращает ленту в себя же.
    this._period = this._step * CASES.length;
    this._slabs = [...rail.querySelectorAll('.slab')];

    this._draw();
  }

  /**
   * Копий ровно столько, чтобы лента закрыла окно при любом сдвиге внутри
   * периода. Ширину колонки оцениваем по нижней границе: период получается
   * минимальным, значит копий — с запасом, какой бы ни была вёрстка.
   */
  static fitCopies() {
    // Видимая часть барабана — дуга ±EDGE радиан плюс одна карточка на краю.
    // Ширина колонки сокращается, поэтому число копий от окна не зависит.
    const arc = 2 * EDGE * RADIUS * CARD_H + CARD_H;
    return Math.max(2, Math.ceil(arc / (STEP * CASES.length)) + 1);
  }

  _setupDrag() {
    // Draggable тащит невидимого двойника: сам трек двигаем мы, иначе
    // перестановка на краю дралась бы с трансформом плагина.
    const proxy = document.createElement('div');
    const start = { y: 0 };

    [this._drag] = Draggable.create(proxy, {
      type: 'y',
      trigger: this._rail.value,
      inertia: true,
      // Лента бесконечна, границ нет — инерция просто докатывается.
      allowNativeTouchScrolling: false,
      onPress: () => {
        this._held = true;
        this._spin = 0;
        start.y = this._y;
        gsap.set(proxy, { y: 0 });
        this._drag.update();
      },
      onDrag: () => {
        this._y = start.y + this._drag.y;
        this._draw();
      },
      onThrowUpdate: () => {
        this._y = start.y + this._drag.y;
        this._draw();
      },
      onRelease: () => {
        // Пока инерция докатывает, самоход молчит — иначе лента дёрнулась бы.
        this._held = this._drag.isThrowing;
      },
      onThrowComplete: () => {
        this._held = false;
      },
    });

    this._onWheel = (event) => {
      event.preventDefault();
      // Колесо перебивает докатывание броска: иначе две силы тянули бы ленту.
      if (this._drag.isThrowing) this._drag.tween?.kill();
      this._held = false;
      this._spin -= event.deltaY * 1.6;
    };
    this._rail.value?.addEventListener('wheel', this._onWheel, { passive: false });
  }

  /** Карточка под курсором: она выходит вперёд, а лента при этом замирает. */
  _hover(slab) {
    if (this._hovered === slab) return;
    this._hovered = slab;
    this._still = Boolean(slab);
  }

  /** Кадр самохода и докатывания колеса. */
  _advance(dt) {
    if (!this._rail.value) return;

    if (this._spin) {
      this._y += this._spin * dt;
      // Трение, не зависящее от частоты кадров: на 120 Гц докат той же длины.
      this._spin *= Math.pow(0.03, dt);
      if (Math.abs(this._spin) < 1) this._spin = 0;
    }

    if (!this._held && !this._spin && !this._still) {
      this._y -= AUTO * this._rail.value.clientWidth * dt;
    }

    this._draw();
  }

  /**
   * Сдвиг ленты. Позиция сворачивается в один период: карточки, уехавшие за
   * край, оказываются точной копией тех, что приходят с другой стороны, —
   * поэтому стык не виден и DOM не растёт.
   */
  _draw(dt = 0) {
    if (!this._slabs?.length || !this._period) return;

    const wrapped = (((this._y % this._period) + this._period) % this._period)
      - this._period;

    this._slabs.forEach((slab, index) => {
      // Путь по дуге от верхнего края окна до середины карточки.
      const arc = index * this._step + wrapped + this._card / 2;
      // Угол на барабане: 0 — карточка смотрит прямо на зрителя, дальше она
      // заваливается назад. Отсюда берутся и наклон, и сжатие, и трапеция —
      // всё это настоящая перспектива, а не нарисованный скос.
      const angle = -(arc - this._height / 2) / this._radius;

      // Подъём под курсором догоняет цель плавно и независимо от частоты
      // кадров, поэтому карточка выходит вперёд, а не прыгает.
      const target = slab === this._hovered ? 1 : 0;
      const lift = (slab.lift ?? 0) + (target - (slab.lift ?? 0)) * (1 - Math.exp(-dt * 12));
      slab.lift = Math.abs(lift - target) < 0.001 ? target : lift;

      const far = Math.abs(angle) > EDGE;
      slab.style.opacity = far ? '0' : '1';
      slab.style.pointerEvents = far ? 'none' : 'auto';
      if (far) return;

      const tilt = angle * (1 - STRAIGHTEN * slab.lift);
      const depth = this._radius + this._card * LIFT * slab.lift;
      slab.style.transform = `rotateX(${tilt.toFixed(4)}rad) translateZ(${depth.toFixed(1)}px)`;
      // Ушедшее вдаль темнеет; то, что под курсором, возвращается к свету.
      const shade = 1 - 0.3 * (1 - Math.cos(angle)) * (1 - slab.lift);
      slab.style.filter = `brightness(${shade.toFixed(3)})`;
    });
  }

  _title(item) {
    if (typeof item.title === 'string') return item.title;
    return item.title[this.lang] ?? item.title.ru ?? '';
  }

  _category(key) {
    const category = CATEGORIES[key];
    if (!category) return key;
    return category[this.lang] ?? category.ru;
  }

  _go(section) {
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: section, bubbles: true, composed: true }),
    );
  }

  _preview(item) {
    return isVideo(item.preview)
      ? html`<video
          class="slab__media"
          src=${item.preview}
          autoplay
          muted
          loop
          playsinline
        ></video>`
      : html`<img class="slab__media" src=${item.preview} alt="" loading="lazy" />`;
  }

  /** Карточка целиком — ссылка на проект, как в разделе кейсов. */
  _slab(item, index) {
    // Подписи на карточках нет: лента читается как поток работ, название
    // живёт в самом превью.
    const inner = this._preview(item);

    // Позицию карточке задаёт барабан в _draw: здесь только её место в ленте.
    const style = `--i: ${index}`;

    return item.link
      ? html`<a
          class="slab"
          style=${style}
          href=${item.link}
          target="_blank"
          rel="noopener"
          >${inner}</a
        >`
      : html`<article class="slab" style=${style}>${inner}</article>`;
  }

  _rail_items() {
    const items = [];
    for (let copy = 0; copy < this.copies; copy += 1) {
      CASES.forEach((item, i) => items.push(this._slab(item, copy * CASES.length + i)));
    }
    return items;
  }

  render() {
    return html`
      <div class="home">
        <!-- Шапка: зацикленное видео под размытием. Полоса шире экрана и
             подрезана по краям — как в макете, где она всегда 1920px. -->
        <div class="home__band">
          <video
            class="home__band-video"
            src="video/header.webm"
            autoplay
            muted
            loop
            playsinline
          ></video>
        </div>
        <div class="home__haze" aria-hidden="true"></div>

        <header class="home__meta">
          <button type="button" class="home__who" @click=${() => this._go('about')}>
            <span>${t('name')}</span>
            <span>${t('role')}</span>
          </button>

          <div class="home__langs">
            ${LOCALES.map(
              (locale) => html`
                <button
                  type="button"
                  lang=${locale.htmlLang}
                  class="home__lang"
                  aria-current=${this.lang === locale.code ? 'true' : 'false'}
                  @click=${() => setLang(locale.code)}
                >
                  ${this.lang === locale.code ? `{${locale.label}}` : locale.label}
                </button>
              `,
            )}
          </div>
        </header>

        <div
          class="home__rail"
          ${ref(this._rail)}
          @pointerover=${(event) => this._hover(event.target.closest('.slab'))}
          @pointerout=${(event) => {
            if (!this.contains(event.relatedTarget)) this._hover(null);
          }}
          @pointerleave=${() => this._hover(null)}
        >
          <div class="home__track" ${ref(this._track)}>${this._rail_items()}</div>
        </div>

        <nav class="home__links">
          <div class="home__filters">
            ${LINKS.map(
              (link) => html`
                <button
                  type="button"
                  class="home__link"
                  ?disabled=${!link.ready}
                  @click=${() => this._go(link.key)}
                >
                  ${link.current ? `{${t(link.label)}}` : t(link.label)}
                </button>
              `,
            )}
          </div>
          <button type="button" class="home__link" @click=${() => this._go('contacts')}>
            ${t('homeWrite')}
          </button>
        </nav>
      </div>
    `;
  }
}

customElements.define('home-screen', HomeScreen);
