import { LitElement, html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';

import { LOCALES, getLang, setLang, t, onLanguageChange } from '../i18n/index.js';
import { fetchWeather, conditionKey } from '../lib/weather.js';
import './weather-ambient.js';
import './site-nav.js';

// Размеры фрейма из Figma. Сцена масштабируется под окно целиком, поэтому
// композиция всегда 1:1 с макетом.
const FRAME = { width: 1920, height: 1080 };

/** Отладочный переключатель: ?wx=storm показывает нужную погоду. */
function weatherOverride() {
  const value = new URLSearchParams(location.search).get('wx');
  const known = ['clear', 'sunny', 'cloudy', 'fog', 'rain', 'snow', 'storm'];
  return known.includes(value) ? value : null;
}

/**
 * Общий каркас внутренних разделов.
 *
 * Раньше кейсы и архив рисовали свою шапку и уводили меню вниз экрана — и сайт
 * разваливался на два разных сайта. Каркас один на все разделы: та же сцена
 * макета, тот же угол с именем и языками, то же меню слева, та же погода внизу.
 * Раздел приносит только своё содержимое и подписи к поиску.
 *
 * Наследник обязан определить:
 *   section       — ключ раздела для меню
 *   searchLabel   — плейсхолдер поиска
 *   renderContent — само содержимое раздела
 */
export class StageScreen extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    lang: { state: true },
    weather: { state: true },
    weatherError: { state: true },
    query: { state: true },
    scale: { state: true },
  };

  constructor() {
    super();
    this.lang = getLang();
    this.weather = null;
    this.weatherError = false;
    this.query = '';
    // Масштаб считаем до первой отрисовки, а не в firstUpdated: там он
    // проставлялся уже после того, как браузер успевал показать кадр, и сцена
    // мелькала неотмасштабированной — меню с погодой на мгновение уезжали
    // за край экрана.
    this.scale = StageScreen.fitScale();
    this._override = weatherOverride();
  }

  connectedCallback() {
    super.connectedCallback();
    this._offLang = onLanguageChange(() => {
      this.lang = getLang();
    });
    this._onResize = () => {
      this.scale = StageScreen.fitScale();
    };
    window.addEventListener('resize', this._onResize);
    this._loadWeather();
  }

  disconnectedCallback() {
    this._offLang?.();
    window.removeEventListener('resize', this._onResize);
    super.disconnectedCallback();
  }

  /** Вписываем фрейм макета в окно целиком, единым масштабом по обеим осям. */
  static fitScale() {
    return Math.min(
      window.innerWidth / FRAME.width,
      window.innerHeight / FRAME.height,
    );
  }

  async _loadWeather() {
    if (this._override) {
      this.weather = { condition: this._override, temperature: 22, isDay: true };
      return;
    }
    try {
      this.weather = await fetchWeather();
      this.weatherError = false;
    } catch {
      this.weather = null;
      this.weatherError = true;
    }
  }

  _conditionLabel() {
    if (this.weatherError) return t('weatherFailed');
    if (!this.weather) return t('weatherLoading');
    return t(conditionKey(this.weather.condition));
  }

  _temperatureLabel() {
    if (this.weatherError) return '—';
    if (!this.weather) return t('weatherLoading');
    const value = this.weather.temperature;
    return `${value > 0 ? '+' : ''}${value} °C`;
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

  /**
   * Поиск набран тем же языком, что языки в углу: слово в квадратных скобках.
   * Ни рамки, ни линейки, ни серой плашки — строка растёт по мере набора,
   * потому что ширину задаёт невидимый двойник текста в той же ячейке грида.
   */
  _search() {
    return html`
      <label class="find rough">
        <span class="find__bracket">[</span>
        <span class="find__field" data-value=${this.query || this.searchLabel}>
          <input
            type="search"
            size="1"
            class="find__input"
            .value=${this.query}
            placeholder=${this.searchLabel}
            aria-label=${this.searchLabel}
            @input=${(event) => this._onQuery(event.target.value)}
          />
        </span>
        <span class="find__bracket">]</span>
      </label>
    `;
  }

  /** Наследник может доопределить: например, сбросить порцию ленты. */
  _onQuery(value) {
    this.query = value;
  }

  /** Разделу без содержимого поиск не нужен — искать в нём пока нечего. */
  get hasSearch() {
    return true;
  }

  render() {
    return html`
      <weather-ambient
        condition=${this.weather?.condition ?? 'none'}
      ></weather-ambient>

      <site-nav where="overlay" current=${this.section}></site-nav>

      <section class="about stage stage--${this.section}">
        <div
          ${ref(this.stageRef)}
          class="about__stage"
          style="--about-scale: ${this.scale}"
        >
          <div class="about__corner rough">
            <div>${t('name')}</div>
            <div class="about__role">${t('role')}</div>
            <div class="about__langs">${this._langButtons()}</div>
          </div>

          ${this.hasSearch ? this._search() : null}

          <site-nav where="stage" current=${this.section}></site-nav>

          <div class="stage__feed rough">${this.renderContent()}</div>

          <div class="about__widget">
            <video
              class="about__media about__media--city"
              src="video/about-2.mp4"
              autoplay
              muted
              loop
              playsinline
              preload="auto"
            ></video>
            <div class="about__weather rough">
              <span class="about__weather-city">${t('city')}</span>
              <span class="about__weather-temp italic">${this._temperatureLabel()}</span>
              <span class="about__weather-state">${this._conditionLabel()}</span>
            </div>
          </div>
        </div>
      </section>
    `;
  }
}
