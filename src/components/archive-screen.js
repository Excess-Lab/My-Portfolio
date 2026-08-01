import { html } from 'lit';

import { t } from '../i18n/index.js';
import { sortedIdeas } from '../data/ideas.js';
import { StageScreen } from './stage-screen.js';

// Раздел пока закрыт: открывается, но вместо ленты показывает, что он в
// работе. Сама лента ниже готова — чтобы включить её, достаточно снять флаг.
const IN_PROGRESS = true;

/**
 * Архив идей: список мыслей, каждая раскрывается на месте.
 *
 * В отличие от кейсов здесь нет ни превью, ни ссылок наружу — только дата,
 * название и текст. Мысль читают тут же, поэтому раскрытие идёт по месту, а не
 * уводит на отдельную страницу: архив листают, а не изучают по одной записи.
 */
class ArchiveScreen extends StageScreen {
  static properties = {
    ...StageScreen.properties,
    open: { state: true },
  };

  constructor() {
    super();
    this.section = 'archive';
    // Раскрытые мысли: сразу несколько, чтобы можно было сравнить соседние.
    this.open = new Set();
  }

  get searchLabel() {
    return t('searchIdeas');
  }

  get hasSearch() {
    return !IN_PROGRESS;
  }

  get searchCount() {
    return `${this._found().length}`;
  }

  _found() {
    return sortedIdeas().filter((idea) => this._matches(idea));
  }

  _field(value) {
    if (typeof value === 'string') return value;
    return value?.[this.lang] ?? value?.ru ?? '';
  }

  /** Дата словами на языке сайта: «14 июля 2026», а не «2026-07-14». */
  _date(idea) {
    const locale = { ru: 'ru-RU', en: 'en-GB', sr: 'sr-RS' }[this.lang] ?? 'ru-RU';
    return (
      new Date(idea.date)
        .toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
        // Русская локаль добавляет «г.» — в макете таких сокращений нет.
        .replace(/\s*г\.$/, '')
    );
  }

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

  _idea(idea) {
    const open = this.open.has(idea.id);

    return html`
      <article class="idea" data-open=${open ? 'true' : 'false'}>
        <button
          type="button"
          class="idea__head"
          aria-expanded=${open ? 'true' : 'false'}
          @click=${() => this._toggle(idea.id)}
        >
          <span class="idea__date">${this._date(idea)}</span>
          <span class="idea__title">${this._field(idea.title)}</span>
          <span class="idea__action">${open ? t('ideaHide') : t('ideaRead')}</span>
        </button>

        <!-- Раскрытие через grid-template-rows: высота считается по реальному
             тексту, без подгонки max-height на глаз. Потомок ровно один. -->
        <div class="idea__body">
          <div class="idea__inner">
            ${this._field(idea.text)
              .split(/\n\s*\n/)
              .map((paragraph) => html`<p class="idea__text">${paragraph}</p>`)}
          </div>
        </div>
      </article>
    `;
  }

  renderContent() {
    if (IN_PROGRESS) {
      return html`
        <div class="stage__draft">
          <p class="stage__draft-title">${t('draftTitle')}</p>
          <p class="stage__draft-note">${t('draftNote')}</p>
        </div>
      `;
    }

    const found = this._found();

    return html`
      <div class="ideas">
        ${found.length
          ? found.map((idea) => this._idea(idea))
          : html`<p class="stage__empty">${t('searchEmpty')}</p>`}
      </div>
    `;
  }
}

customElements.define('archive-screen', ArchiveScreen);
