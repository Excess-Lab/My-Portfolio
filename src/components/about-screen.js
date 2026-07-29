import { LitElement, html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';

import { LOCALES, getLang, setLang, t, onLanguageChange } from '../i18n/index.js';
import { fetchWeather, conditionKey } from '../lib/weather.js';
import './weather-ambient.js';

import starUrl from '../assets/star.svg';

// Разделы меню. Кроме «обо мне» они появятся позже — пока просто помечены.
const SECTIONS = ['cases', 'archive', 'gallery', 'contacts'];

// Размеры фрейма из Figma. Сцена масштабируется под окно целиком, поэтому
// композиция всегда 1:1 с макетом.
const FRAME = { width: 1920, height: 1080 };

/** Отладочный переключатель: ?wx=storm показывает нужную погоду. */
function weatherOverride() {
  const value = new URLSearchParams(location.search).get('wx');
  const known = ['clear', 'sunny', 'cloudy', 'fog', 'rain', 'snow', 'storm'];
  return known.includes(value) ? value : null;
}

class AboutScreen extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    lang: { state: true },
    weather: { state: true },
    weatherError: { state: true },
    menuOpen: { state: true },
  };

  constructor() {
    super();
    this.lang = getLang();
    this.weather = null;
    this.weatherError = false;
    this.stageRef = createRef();
    // На телефоне меню свёрнуто: видно текущий раздел, список открывается по
    // нажатию. На десктопе список всегда развёрнут — там места хватает.
    this.menuOpen = false;
    this._override = weatherOverride();
  }

  connectedCallback() {
    super.connectedCallback();
    this._offLang = onLanguageChange(() => {
      this.lang = getLang();
    });
    this._onResize = () => this._fitStage();
    window.addEventListener('resize', this._onResize);
    this._loadWeather();
  }

  disconnectedCallback() {
    this._offLang?.();
    window.removeEventListener('resize', this._onResize);
    super.disconnectedCallback();
  }

  firstUpdated() {
    this._fitStage();
  }

  /**
   * Вписываем фрейм макета в окно целиком. Масштаб единый по обеим осям,
   * поэтому композиция не разъезжается ни при каком соотношении сторон.
   */
  _fitStage() {
    const stage = this.stageRef.value;
    if (!stage) return;

    const scale = Math.min(
      window.innerWidth / FRAME.width,
      window.innerHeight / FRAME.height,
    );
    stage.style.setProperty('--about-scale', scale);
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
      // Живых данных нет — честно показываем это в блоке, а атмосферу
      // оставляем нейтральной, без выдуманной погоды.
      this.weather = null;
      this.weatherError = true;
    }
  }

  /** Подпись состояния: пока грузится — прочерк, при отказе — «нет связи». */
  _conditionLabel() {
    if (this.weatherError) return t('weatherFailed');
    if (!this.weather) return t('weatherLoading');
    return t(conditionKey(this.weather.condition));
  }

  _temperatureLabel() {
    if (this.weatherError) return '—';
    if (!this.weather) return t('weatherLoading');
    // Плюс проставляем сами: API отдаёт знак только для минуса.
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
   * Ролики пересобраны с интерполяцией кадров до 60fps, а строка стека —
   * замедлена прямо в файле. Раньше я замедлял её через playbackRate, но
   * исходник 30fps на скорости 0.7 давал 21 кадр в секунду, и глаз это ловил
   * как дёрганость.
   */
  _video(kind, file) {
    return html`
      <video
        class="about__media about__media--${kind}"
        src="video/${file}"
        autoplay
        muted
        loop
        playsinline
        preload="auto"
      ></video>
    `;
  }

  render() {
    const condition = this.weather?.condition ?? 'none';

    return html`
      <weather-ambient condition=${condition}></weather-ambient>

      <!-- Подложка живёт снаружи section.about не случайно: на нём висит
           фильтр «разрушенного» текста, а backdrop-filter внутри элемента с
           filter размывать нечего — фильтр предка обрывает ему фон. -->
      <div
        class="about__scrim"
        data-open=${this.menuOpen ? 'true' : 'false'}
        @click=${() => {
          this.menuOpen = false;
        }}
      ></div>

      <section class="about rough">
        <div ${ref(this.stageRef)} class="about__stage">
          <div class="about__corner">
            <div>${t('name')}</div>
            <div class="about__role">${t('role')}</div>
            <div class="about__langs">${this._langButtons()}</div>
          </div>

          ${this._video('intro', 'about-1.mp4')}

          <div class="about__block about__block--about">
            <h2 class="about__title">${t('about')}</h2>
            <p class="about__text">${t('aboutText')}</p>
          </div>

          <div class="about__block about__block--stack">
            <span class="about__stack-label">${t('stack')}</span>
            ${this._video('stack', 'about-3.mp4')}
          </div>

          <nav class="about__nav" data-open=${this.menuOpen ? 'true' : 'false'}>
            <button
              type="button"
              class="about__nav-active"
              aria-expanded=${this.menuOpen ? 'true' : 'false'}
              @click=${() => {
                this.menuOpen = !this.menuOpen;
              }}
            >
              <img src=${starUrl} alt="" class="about__star" />
              ${t('about')}
              <span class="about__nav-caret" aria-hidden="true">
                <span>${this.menuOpen ? t('menuHide') : t('menuShow')}</span>
                <span>${t('menuList')}</span>
              </span>
            </button>
            <div class="about__nav-rest">
              <div class="about__nav-list">
              ${SECTIONS.map(
                (key) => html`
                  <button
                    type="button"
                    disabled
                    class="bg-transparent p-0 font-serif tracking-[inherit] whitespace-nowrap"
                    style="font-size: inherit; color: inherit;"
                  >
                    ${t(key)}
                  </button>
                `,
              )}
              </div>
            </div>
          </nav>

          <!-- На десктопе погода и видео стоят по координатам макета порознь,
               на телефоне собираются в одну карточку. Обёртка на десктопе
               прозрачна для раскладки (display: contents), поэтому координаты
               не ломаются. -->
          <div class="about__widget">
            ${this._video('city', 'about-2.mp4')}
            <div class="about__weather">
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

customElements.define('about-screen', AboutScreen);
