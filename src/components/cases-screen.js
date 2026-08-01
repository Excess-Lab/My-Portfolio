import { LitElement, html } from 'lit';

import { LOCALES, getLang, setLang, t, onLanguageChange } from '../i18n/index.js';
import { fetchWeather } from '../lib/weather.js';
import { CASES, CATEGORIES, isVideo } from '../data/cases.js';
import './weather-ambient.js';
import './site-nav.js';

// Сколько карточек показываем сразу и сколько добавляем при прокрутке.
// Лента ведёт себя бесконечной: подгрузка идёт по мере приближения к низу,
// поэтому список любой длины открывается мгновенно.
const PAGE = 6;

/** Отладочный переключатель: ?wx=storm показывает нужную погоду. */
function weatherOverride() {
  const value = new URLSearchParams(location.search).get('wx');
  const known = ['clear', 'sunny', 'cloudy', 'fog', 'rain', 'snow', 'storm'];
  return known.includes(value) ? value : null;
}

class CasesScreen extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    lang: { state: true },
    weather: { state: true },
    query: { state: true },
    shown: { state: true },
  };

  constructor() {
    super();
    this.lang = getLang();
    this.weather = null;
    this.query = '';
    this.shown = PAGE;
    this._override = weatherOverride();
  }

  connectedCallback() {
    super.connectedCallback();
    this._offLang = onLanguageChange(() => {
      this.lang = getLang();
    });
    this._loadWeather();
  }

  disconnectedCallback() {
    this._offLang?.();
    super.disconnectedCallback();
  }

  async _loadWeather() {
    if (this._override) {
      this.weather = { condition: this._override };
      return;
    }
    try {
      this.weather = await fetchWeather();
    } catch {
      this.weather = null;
    }
  }

  /**
   * Название и описание живут по языкам. Название можно задать и строкой —
   * тогда оно одинаковое везде: у части проектов переводить нечего.
   */
  _title(item) {
    if (typeof item.title === 'string') return item.title;
    return item.title[this.lang] ?? item.title.ru ?? '';
  }

  _description(item) {
    return item.description[this.lang] ?? item.description.ru ?? '';
  }

  _category(key) {
    const category = CATEGORIES[key];
    if (!category) return key;
    return category[this.lang] ?? category.ru;
  }

  /**
   * Поиск по словам: совпасть должны все введённые слова, но каждое — где
   * угодно: в названии, описании, категории или годе. Так «сайт 2025» находит
   * проект, даже если эти слова стоят в разных полях.
   */
  _matches(item) {
    const words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;

    // Ищем сразу по всем переводам: набранное по-английски название находится
    // и когда сайт открыт на русском.
    const variants = (field) =>
      typeof field === 'string' ? [field] : Object.values(field ?? {});

    const haystack = [
      ...variants(item.title),
      ...variants(item.description),
      item.year,
      ...variants(CATEGORIES[item.category]),
    ]
      .join(' ')
      .toLowerCase();

    return words.every((word) => haystack.includes(word));
  }

  /** Долистали до конца — добавляем следующую порцию. */
  _onScroll(event) {
    const el = event.currentTarget;
    const remaining = el.scrollHeight - el.scrollTop - el.clientHeight;
    if (remaining < 600) this.shown += PAGE;
  }

  _preview(item) {
    return isVideo(item.preview)
      ? html`
          <video
            class="cases__preview"
            src=${item.preview}
            autoplay
            muted
            loop
            playsinline
          ></video>
        `
      : html`<img class="cases__preview" src=${item.preview} alt="" loading="lazy" />`;
  }

  /**
   * Карточка целиком и есть ссылка: кликается и обложка, и название, и текст.
   * Отдельная стрелка в углу была лишней мишенью — в неё ещё надо попасть,
   * а карточка и так выглядит как то, что нажимают.
   */
  _card(item) {
    const inner = html`
      <div class="cases__frame">${this._preview(item)}</div>
      <div class="cases__meta">
        <h3 class="cases__name">${this._title(item)}</h3>
        <span class="cases__tag">${this._category(item.category)} · ${item.year}</span>
      </div>
      <p class="cases__text">${this._description(item)}</p>
    `;

    return item.link
      ? html`
          <a
            class="cases__card cases__card--link"
            href=${item.link}
            target="_blank"
            rel="noopener"
          >
            ${inner}
          </a>
        `
      : html`<article class="cases__card">${inner}</article>`;
  }

  _langButtons() {
    return LOCALES.map(
      (locale) => html`
        <button
          type="button"
          lang=${locale.htmlLang}
          @click=${() => setLang(locale.code)}
          aria-current=${this.lang === locale.code ? 'true' : 'false'}
          class="cursor-pointer bg-transparent p-0 font-serif tracking-[inherit] whitespace-nowrap transition-opacity hover:opacity-60 ${this
            .lang === locale.code
            ? 'italic'
            : ''}"
          style="font-size: inherit; color: inherit;"
        >
          [${locale.label}]
        </button>
      `,
    );
  }

  render() {
    const found = CASES.filter((item) => this._matches(item));
    const visible = found.slice(0, this.shown);

    return html`
      <weather-ambient condition=${this.weather?.condition ?? 'none'}></weather-ambient>

      <site-nav where="overlay" current="cases"></site-nav>

      <section class="about cases">
        <div class="cases__head">
          <div class="about__corner rough">
            <div>${t('name')}</div>
            <div class="about__role">${t('role')}</div>
            <div class="about__langs">${this._langButtons()}</div>
          </div>

          <div class="cases__search rough">
            <input
              type="search"
              class="cases__input"
              .value=${this.query}
              placeholder=${t('search')}
              aria-label=${t('search')}
              @input=${(event) => {
                this.query = event.target.value;
                // Новый запрос — снова показываем первую порцию.
                this.shown = PAGE;
              }}
            />
            <span class="cases__count">${found.length} ${t('casesCount')}</span>
          </div>
        </div>

        <!-- Лента: карточки идут потоком, подгружаясь по мере прокрутки. -->
        <div class="cases__feed rough" @scroll=${this._onScroll}>
          ${visible.length
            ? visible.map((item) => this._card(item))
            : html`<p class="cases__empty">${t('searchEmpty')}</p>`}
        </div>
      </section>
    `;
  }
}

customElements.define('cases-screen', CasesScreen);
