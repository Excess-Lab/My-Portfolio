import { LitElement, html, css } from 'lit';
import { shared } from '../styles/shared.js';
import { about } from '../data/content.js';

class AboutSection extends LitElement {
  static properties = { animate: { type: Boolean, reflect: true } };

  static styles = [
    shared,
    css`
      .grid {
        display: grid;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
        gap: clamp(2rem, 6vw, 5rem);
        align-items: start;
      }

      .body p {
        font-size: clamp(1rem, 1.6vw, 1.125rem);
        color: var(--text);
      }

      .body p + p {
        color: var(--text-dim);
      }

      @media (max-width: 720px) {
        .grid {
          grid-template-columns: 1fr;
        }
      }
    `,
  ];

  render() {
    return html`
      <section id="about">
        <div class="wrap grid">
          <div>
            <span class="eyebrow" data-reveal>01 — обо мне</span>
            <h2 data-reveal>Коротко</h2>
          </div>
          <div class="body">
            ${about.map((para) => html`<p data-reveal>${para}</p>`)}
          </div>
        </div>
      </section>
    `;
  }
}

customElements.define('about-section', AboutSection);
