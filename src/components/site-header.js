import { LitElement, html, css } from 'lit';
import { shared } from '../styles/shared.js';
import { profile, nav } from '../data/content.js';

class SiteHeader extends LitElement {
  static styles = [
    shared,
    css`
      :host {
        position: sticky;
        top: 0;
        z-index: 10;
        backdrop-filter: blur(12px);
        background: color-mix(in srgb, var(--bg) 82%, transparent);
        border-bottom: 1px solid transparent;
        transition: border-color 0.3s ease;
      }

      :host([scrolled]) {
        border-bottom-color: var(--line);
      }

      .bar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1.5rem;
        height: 64px;
      }

      .mark {
        font-family: var(--mono);
        font-weight: 600;
        letter-spacing: -0.02em;
      }

      .mark span {
        color: var(--accent);
      }

      nav {
        display: flex;
        gap: 1.75rem;
      }

      nav a {
        font-size: 0.9375rem;
        color: var(--text-dim);
        transition: color 0.2s ease;
      }

      nav a:hover {
        color: var(--text);
      }

      @media (max-width: 640px) {
        nav {
          display: none;
        }
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this._onScroll = () => this.toggleAttribute('scrolled', window.scrollY > 8);
    window.addEventListener('scroll', this._onScroll, { passive: true });
    this._onScroll();
  }

  disconnectedCallback() {
    window.removeEventListener('scroll', this._onScroll);
    super.disconnectedCallback();
  }

  render() {
    return html`
      <div class="wrap bar">
        <a class="mark" href="#top">${profile.name}<span>.</span></a>
        <nav>
          ${nav.map((item) => html`<a href=${item.href}>${item.label}</a>`)}
        </nav>
      </div>
    `;
  }
}

customElements.define('site-header', SiteHeader);
