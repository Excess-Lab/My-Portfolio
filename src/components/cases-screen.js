import { html } from 'lit';

import { t } from '../i18n/index.js';
import { CASES, CATEGORIES, isVideo } from '../data/cases.js';
import { StageScreen } from './stage-screen.js';

// Сколько карточек показываем сразу и сколько добавляем при прокрутке.
// Лента ведёт себя бесконечной: подгрузка идёт по мере приближения к низу,
// поэтому список любой длины открывается мгновенно.
const PAGE = 6;

class CasesScreen extends StageScreen {
  static properties = {
    ...StageScreen.properties,
    shown: { state: true },
  };

  constructor() {
    super();
    this.section = 'cases';
    this.shown = PAGE;
  }

  get searchLabel() {
    return t('search');
  }

  get searchCount() {
    return `${this._found().length}`;
  }

  _onQuery(value) {
    this.query = value;
    // Новый запрос — снова показываем первую порцию.
    this.shown = PAGE;
  }

  _found() {
    return CASES.filter((item) => this._matches(item));
  }

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
   * угодно. Ищем сразу по всем переводам, поэтому набранное по-английски
   * находится и когда сайт открыт на русском.
   */
  _matches(item) {
    const words = this.query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return true;

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
            class="case__preview"
            src=${item.preview}
            autoplay
            muted
            loop
            playsinline
          ></video>
        `
      : html`<img class="case__preview" src=${item.preview} alt="" loading="lazy" />`;
  }

  /** Карточка целиком и есть ссылка: кликается и обложка, и название, и текст. */
  _card(item) {
    const inner = html`
      <span class="case__frame">${this._preview(item)}</span>
      <span class="case__name">${this._title(item)}</span>
      <span class="case__tag">${this._category(item.category)} · ${item.year}</span>
      <span class="case__text">${this._description(item)}</span>
    `;

    return item.link
      ? html`
          <a class="case case--link" href=${item.link} target="_blank" rel="noopener">
            ${inner}
          </a>
        `
      : html`<article class="case">${inner}</article>`;
  }

  renderContent() {
    const found = this._found();
    const visible = found.slice(0, this.shown);

    return html`
      <div class="cases" @scroll=${this._onScroll}>
        ${visible.length
          ? visible.map((item) => this._card(item))
          : html`<p class="stage__empty">${t('searchEmpty')}</p>`}
      </div>
    `;
  }
}

customElements.define('cases-screen', CasesScreen);
