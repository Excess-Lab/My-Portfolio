import { LitElement, html } from 'lit';
import { gsap } from 'gsap';

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

  _go(section, button) {
    this.open = false;
    delete document.body.dataset.menuOpen;

    if (section === this.current) return;
    this._flyToCurrent(button);
    this.dispatchEvent(
      new CustomEvent('navigate', { detail: section, bubbles: true, composed: true }),
    );
  }

  /**
   * Выбранный пункт уезжает влево, к левому краю меню.
   *
   * Экран сменяется целиком, поэтому анимировать сам пункт нельзя — его тут же
   * не станет. Едет двойник поверх страницы: стартует там, где пункт стоял в
   * списке, и уходит по своей строке влево, туда, где стоит название текущего
   * раздела. Пока он едет, под ним проступает новый экран, и смена читается как
   * движение выбранного пункта, а не как подмена кадра.
   */
  _flyToCurrent(button) {
    const label = this.querySelector('.site-nav__label');
    if (!button || !label || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }

    const from = button.getBoundingClientRect();
    const to = label.getBoundingClientRect();
    if (!from.width || !to.width) return;

    // Меню внутри сцены отмасштабировано: сравнение экранной ширины с вёрсточной
    // даёт множитель, иначе двойник улетел бы в своём кегле.
    const scale = from.width / (button.offsetWidth || from.width);
    const style = getComputedStyle(button);

    const clone = document.createElement('span');
    clone.textContent = button.textContent.trim();
    Object.assign(clone.style, {
      position: 'fixed',
      left: `${from.left}px`,
      top: `${from.top}px`,
      margin: '0',
      font: style.font,
      letterSpacing: style.letterSpacing,
      color: style.color,
      whiteSpace: 'nowrap',
      transformOrigin: 'left top',
      pointerEvents: 'none',
      zIndex: '60',
    });
    document.body.append(clone);

    gsap.set(clone, { scale });
    // Только влево, по своей строке: пункт уходит к левому краю меню, туда, где
    // стоит название текущего раздела. Никаких прыжков по вертикали — движение
    // читается как «этот пункт стал текущим», а не как перелёт по экрану.
    gsap.to(clone, {
      x: to.left - from.left,
      duration: 0.62,
      ease: 'power3.inOut',
      onComplete: () => clone.remove(),
    });
    // Гаснет у самой цели: на месте уже стоит настоящее название.
    gsap.to(clone, { opacity: 0, duration: 0.18, delay: 0.5 });
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
        <!-- Строка раздела закреплена за ним навсегда: порядок пунктов не
             перетасовывается при переходе. Текущий раздел просто уезжает влево
             и получает звезду, а прежний возвращается в свою строку справа —
             поэтому меню читается как одна неподвижная опись, по которой ездит
             отметка, а не как список, прыгающий на каждом клике. -->
        <button
          type="button"
          class="site-nav__current"
          style="--row: ${SECTIONS.indexOf(this.current) + 1}"
          aria-expanded=${this.open ? 'true' : 'false'}
          @click=${() => this._toggle()}
        >
          <img src=${starIcon} alt="" class="site-nav__star" />
          <span class="site-nav__label">${t(this.current)}</span>
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
                  style="--row: ${SECTIONS.indexOf(key) + 1}"
                  ?disabled=${!READY.has(key)}
                  @click=${(event) => this._go(key, event.currentTarget)}
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
