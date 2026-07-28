import { css } from 'lit';

/**
 * Общие стили для всех компонентов. Shadow DOM не пропускает глобальный CSS,
 * поэтому базовую типографику и утилиты подключаем сюда явно.
 * Значения тянутся из CSS-переменных в :root — они наследуются сквозь границу тени.
 */
export const shared = css`
  :host {
    display: block;
    font-family: var(--font);
    color: var(--text);
  }

  .wrap {
    max-width: var(--max);
    margin: 0 auto;
    padding-inline: var(--pad);
  }

  section {
    padding-block: clamp(4rem, 12vh, 8rem);
  }

  h2 {
    font-size: clamp(1.75rem, 4vw, 2.75rem);
    line-height: 1.15;
    letter-spacing: -0.02em;
    margin: 0 0 2.5rem;
    font-weight: 600;
  }

  h3 {
    font-size: 1.125rem;
    font-weight: 600;
    margin: 0;
    letter-spacing: -0.01em;
  }

  p {
    margin: 0 0 1rem;
    color: var(--text-dim);
  }

  a {
    color: var(--text);
    text-decoration: none;
  }

  .eyebrow {
    font-family: var(--mono);
    font-size: 0.8125rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 1rem;
    display: block;
  }

  /* Элементы, которые оживляет GSAP. Скрываем только когда скрипт подтвердил,
     что он загрузился (на :host выставляется атрибут ready). */
  :host([animate]) [data-reveal] {
    opacity: 0;
  }

  @media (prefers-reduced-motion: reduce) {
    :host([animate]) [data-reveal] {
      opacity: 1;
    }
  }
`;
