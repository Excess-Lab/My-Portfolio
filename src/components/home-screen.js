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
// Шаг стопки у нижнего края. Выше каждая карточка и её шаг умножаются на FADE,
// поэтому лента сходится кверху в точку схода — перспектива, а не барабан:
// карточки остаются фронтальными, и то, что на них, не косит.
const STEP = CARD_H * 0.3;
const FADE = 0.945;
// Сколько карточек стопка держит в запасе сверху и снизу от экрана.
const SPAN = 12;

// Скорость самохода: в макете лента проезжает 4346px за 30 секунд.
const AUTO = 4346 / 30 / 732;

// Время, за которое лента съедает основную часть пути до цели.
const EASE = 0.16;

// Под курсором карточка раскрывается в полный размер — какой бы мелкой её ни
// сделала перспектива. Это и есть «раскрыть»: не подрасти на процент, а выйти
// из стопки целиком.
const OPEN = 1;

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
    // Две величины вместо физики с трением: _goal — куда ленту просят приехать,
    // _y — где она сейчас. Каждый кадр _y подтягивается к _goal на одну и ту же
    // долю оставшегося пути, поэтому любой толчок — колесом, самоходом или
    // рукой — въезжает в одно и то же плавное движение, и они не дерутся.
    this._y = 0;
    this._goal = 0;
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
    // Период цикла: сдвиг на весь набор возвращает ленту в себя же.
    this._period = this._step * CASES.length;
    this._slabs = [...rail.querySelectorAll('.slab')];
    this._slabs.forEach((slab, i) => {
      slab.shade = slab.querySelector('.slab__shade');
      slab.index = i;
    });

    this._draw();
  }

  /**
   * Копий ровно столько, чтобы лента закрыла окно при любом сдвиге внутри
   * периода. Ширину колонки оцениваем по нижней границе: период получается
   * минимальным, значит копий — с запасом, какой бы ни была вёрстка.
   */
  static fitCopies() {
    // Стопка живёт в полосе шириной SPAN карточек — больше копий ни при каком
    // окне не понадобится, потому что дальние ужимаются, а не уезжают.
    return Math.max(2, Math.ceil(SPAN / CASES.length) + 1);
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
        start.y = this._y;
        gsap.set(proxy, { y: 0 });
        this._drag.update();
      },
      onDrag: () => {
        this._y = start.y + this._drag.y;
        this._goal = this._y;
        this._draw();
      },
      onThrowUpdate: () => {
        this._y = start.y + this._drag.y;
        this._goal = this._y;
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

      // deltaMode: 0 — пиксели (трекпад и большинство мышей), 1 — строки,
      // 2 — страницы. Без приведения строчное колесо двигало ленту в сотню раз
      // слабее пиксельного, и казалось, что оно не работает.
      const px = event.deltaMode === 1
        ? event.deltaY * 16
        : event.deltaMode === 2
          ? event.deltaY * this._height
          : event.deltaY;

      // Один щелчок мыши (100px) — одна карточка. Трекпад шлёт мелкие дельты
      // и набирает тот же путь плавно, поэтому отдельный режим ему не нужен.
      this._goal -= (px / 100) * this._step;
      // Дальше шести карточек вперёд не забегаем: иначе быстрая прокрутка
      // копит путь на секунды вперёд и лента едет уже без тебя.
      const span = this._step * 6;
      this._goal = Math.max(this._y - span, Math.min(this._y + span, this._goal));
    };

    this._rail.value?.addEventListener('wheel', this._onWheel, { passive: false });
  }

  /** Карточка под курсором: она выходит вперёд, а лента при этом замирает. */
  _hover(slab) {
    if (this._hovered === slab) return;
    this._hovered = slab;
    this._still = Boolean(slab);
  }

  /** Кадр: самоход двигает цель, лента её догоняет. */
  _advance(dt) {
    if (!this._rail.value) return;

    if (this._held) {
      // Рука и инерция ведут ленту напрямую — догонять нечего.
      this._goal = this._y;
    } else {
      if (!this._still) this._goal -= AUTO * this._width * dt;
      // Доля пути за кадр, не зависящая от частоты кадров: на 60 и на 120 Гц
      // лента доезжает за одно и то же время.
      this._y += (this._goal - this._y) * (1 - Math.exp(-dt / EASE));
    }

    this._draw(dt);
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

    this._slabs.forEach((slab) => {
      // Номер карточки в стопке, считая от нижнего края окна и вверх. Дробный:
      // лента едет непрерывно, и карточка плавно переползает со ступени на
      // ступень, а не перескакивает.
      const flat = slab.index * this._step + wrapped;
      const rank = (this._height - flat) / this._step;

      // Геометрическая перспектива: каждая ступень вверх умножает и размер
      // карточки, и её шаг на FADE. Сумма шагов — ряд, который сходится, и
      // кверху стопка упирается в точку схода, как на натуре.
      const scale = Math.pow(FADE, rank);
      const y = this._height - (this._step * (1 - scale)) / (1 - FADE);

      // Подъём под курсором догоняет цель плавно и независимо от частоты
      // кадров, поэтому карточка выходит вперёд, а не прыгает.
      const target = slab === this._hovered ? 1 : 0;
      const lift = (slab.lift ?? 0) + (target - (slab.lift ?? 0)) * (1 - Math.exp(-dt * 12));
      slab.lift = Math.abs(lift - target) < 0.001 ? target : lift;

      const far = scale < 0.1 || y > this._height + this._card || y < -this._card * scale;
      slab.style.visibility = far ? 'hidden' : 'visible';
      if (far) return;

      // Раскрытие тянет масштаб к натуральному, а не умножает текущий: мелкая
      // карточка из глубины открывается так же полно, как ближняя.
      const grow = scale + (OPEN - scale) * slab.lift;
      // Растёт она от верхней кромки, поэтому середину удерживаем сами —
      // иначе раскрытая карточка сползала бы вниз из-под курсора.
      const hold = y - (this._card * (grow - scale)) / 2;
      slab.style.transform = `translate3d(0, ${hold.toFixed(2)}px, 0) scale(${grow.toFixed(4)})`;
      // Ближняя карточка кроет дальнюю, как в стопке. Та, что под курсором,
      // выходит поверх всех — только так её видно целиком, а не полосой.
      slab.style.zIndex = slab.lift > 0.5 ? 9999 : Math.round(1000 - rank * 10);
      // Ушедшее вдаль темнеет; то, что под курсором, возвращается к свету.
      slab.shade.style.opacity = (0.25 * (1 - scale) * (1 - slab.lift)).toFixed(3);
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
    const inner = html`${this._preview(item)}<span class="slab__shade"></span>`;

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
