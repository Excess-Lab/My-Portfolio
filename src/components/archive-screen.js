import { LitElement, html } from 'lit';

import { LOCALES, getLang, setLang, t, onLanguageChange } from '../i18n/index.js';
import { fetchWeather } from '../lib/weather.js';
import { sortedIdeas } from '../data/ideas.js';
import './weather-ambient.js';
import './site-nav.js';

/** Отладочный переключатель: ?wx=storm показывает нужную погоду. */
function weatherOverride() {
  const value = new URLSearchParams(location.search).get('wx');
  const known = ['clear', 'sunny', 'cloudy', 'fog', 'rain', 'snow', 'storm'];
  return known.includes(value) ? value : null;
}

/**
 * Архив идей: список мыслей, каждая раскрывается на месте.
 *
 * В отличие от кейсов здесь нет ни превью, ни ссылок наружу — только дата,
 * название и текст. Мысль читают тут же, поэтому раскрытие идёт по месту, а не
 * уводит на отдельную страницу: архив листают, а не изучают по одной записи.
 */
class ArchiveScreen extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    lang: { state: true },
    weather: { state: true },
    query: { state: true },
    open: { state: true },
  };

  constructor() {
    super();
    this.lang = getLang();
    this.weather = null;
    this.query = '';
    // Раскрытые мысли: сразу несколько, чтобы можно было сравнить соседние.
    this.open = new Set();
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

  _field(value) {
    if (typeof value === 'string') return value;
    return value?.[this.lang] ?? value?.ru ?? '';
  }

  /** Дата словами на языке сайта: «14 июля 2026», а не «2026-07-14». */
  _date(idea) {
    const locale = { ru: 'ru-RU', en: 'en-GB', sr: 'sr-RS' }[this.lang] ?? 'ru-RU';
    return new Date(idea.date).toLocaleDateString(locale, {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  /** Поиск по словам — как в кейсах, сразу по всем переводам и по дате. */
  _matches(idea) {
    const words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;

    const variants = (field) =>
      typeof field === 'string' ? [field] : Object.values(field ?? {});

    const haystack = [
      ...variants(idea.title),
      ...variants(idea.text),
      idea.date,
      this._date(idea),
    ]
      .join(' ')
      .toLowerCase();

    return words.every((word) => haystack.includes(word));
  }

  _toggle(id) {
    const next = new Set(this.open);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this.open = next;
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

  _idea(idea) {
    const open = this.open.has(idea.id);

    return html`
      <article class="ideas__item" data-open=${open ? 'true' : 'false'}>
        <button
          type="button"
          class="ideas__head"
          aria-expanded=${open ? 'true' : 'false'}
          @click=${() => this._toggle(idea.id)}
        >
          <span class="ideas__date">${this._date(idea)}</span>
          <span class="ideas__title">${this._field(idea.title)}</span>
          <span class="ideas__action">${open ? t('ideaHide') : t('ideaRead')}</span>
        </button>

        <!-- Раскрытие через grid-template-rows: высота считается по реальному
             тексту, без подгонки max-height на глаз. Потомок ровно один. -->
        <div class="ideas__body">
          <div class="ideas__inner">
            ${this._field(idea.text)
              .split(/\n\s*\n/)
              .map((paragraph) => html`<p class="ideas__text">${paragraph}</p>`)}
          </div>
        </div>
      </article>
    `;
  }

  render() {
    const found = sortedIdeas().filter((idea) => this._matches(idea));

    return html`
      <weather-ambient condition=${this.weather?.condition ?? 'none'}></weather-ambient>

      <site-nav where="overlay" current="archive"></site-nav>

      <section class="about cases ideas">
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
              placeholder=${t('searchIdeas')}
              aria-label=${t('searchIdeas')}
              @input=${(event) => {
                this.query = event.target.value;
              }}
            />
            <span class="cases__count">${found.length} ${t('ideasCount')}</span>
          </div>
        </div>

        <div class="ideas__feed rough">
          ${found.length
            ? found.map((idea) => this._idea(idea))
            : html`<p class="cases__empty">${t('searchEmpty')}</p>`}
        </div>
      </section>
    `;
  }
}

customElements.define('archive-screen', ArchiveScreen);
