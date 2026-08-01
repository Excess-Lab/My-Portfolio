import { LitElement, html } from 'lit';

import { t, getLang, onLanguageChange } from '../i18n/index.js';
import starIcon from '../assets/star.svg';

/**
 * Меню разделов. Общее для всех экранов, поэтому живёт отдельным компонентом:
 * иначе разметку и логику пришлось бы копировать в каждый.
 *
 * Рендерится двумя копиями. Внутри сцены — там у неё координаты макета; снаружи
 * секции — только такая копия может лечь поверх подложки, потому что у блоков
 * с текстом есть свой фильтр, а он запирает z-index внутри себя.
 *
 * Открытое меню размывает контент через атрибут на <body>: так экрану не нужно
 * ничего знать про меню, а меню — про экран.
 */

export const SECTIONS = ['about', 'cases', 'archive', 'gallery', 'contacts'];

// Разделы, которые уже сверстаны. Остальные показываем приглушёнными.
export const READY = new Set(['about', 'cases']);

class SiteNav extends LitElement {
  createRenderRoot() {
    return this;
  }

  static properties = {
    current: { type: String },
    where: { type: String },
    open: { state: true },
  };

  constructor() {
    super();
    this.current = 'about';
    this.where = 'stage';
    this.open = false;
    this.lang = getLang();
  }

  connectedCallback() {
    super.connectedCallback();
    this._offLang = onLanguageChange(() => this.requestUpdate());
  }

  disconnectedCallback() {
    this._offLang?.();
    delete document.body.dataset.menuOpen;
    super.disconnectedCallback();
  }

  _toggle() {
    this.open = !this.open;
    if (this.open) document.body.dataset.menuOpen = 'true';
    else delete document.body.dataset.menuOpen;
  }

  _go(section) {
    this.open = false;
    delete document.body.dataset.menuOpen;

    if (section === this.current) return;
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: section, bubbles: true, composed: true }),
    );
  }

  render() {
    const rest = SECTIONS.filter((key) => key !== this.current);

    return html`
      ${this.where === 'overlay'
        ? html`
            <div
              class="site-scrim"
              data-open=${this.open ? 'true' : 'false'}
              @click=${() => this._toggle()}
            ></div>
          `
        : null}

      <nav
        class="site-nav rough"
        data-where=${this.where}
        data-open=${this.open ? 'true' : 'false'}
      >
        <button
          type="button"
          class="site-nav__current"
          aria-expanded=${this.open ? 'true' : 'false'}
          @click=${() => this._toggle()}
        >
          <img src=${starIcon} alt="" class="site-nav__star" />
          ${t(this.current)}
          <span class="site-nav__hint" aria-hidden="true">
            <span>${this.open ? t('menuHide') : t('menuShow')}</span>
            <span>${t('menuList')}</span>
          </span>
        </button>

        <div class="site-nav__rest">
          <div class="site-nav__list">
            ${rest.map(
              (key) => html`
                <button
                  type="button"
                  ?disabled=${!READY.has(key)}
                  @click=${() => this._go(key)}
                  class="site-nav__item"
                >
                  ${t(key)}
                </button>
              `,
            )}
          </div>
        </div>
      </nav>
    `;
  }
}

customElements.define('site-nav', SiteNav);
