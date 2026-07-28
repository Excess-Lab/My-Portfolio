import { LitElement, html, css } from 'lit';
import { shared } from '../styles/shared.js';
import { profile, socials } from '../data/content.js';

class HeroSection extends LitElement {
  static properties = { animate: { type: Boolean, reflect: true } };

  static styles = [
    shared,
    css`
      section {
        min-height: min(88svh, 780px);
        display: flex;
        align-items: center;
        position: relative;
      }

      .glow {
        position: absolute;
        inset: -20% 40% 40% -10%;
        background: radial-gradient(
          circle at 30% 40%,
          color-mix(in srgb, var(--accent) 14%, transparent),
          transparent 60%
        );
        filter: blur(40px);
        pointer-events: none;
      }

      h1 {
        font-size: clamp(2.5rem, 8vw, 5rem);
        line-height: 1.02;
        letter-spacing: -0.035em;
        font-weight: 600;
        margin: 0 0 1.5rem;
        max-width: 14ch;
      }

      .role {
        color: var(--accent);
      }

      .tagline {
        font-size: clamp(1rem, 2vw, 1.25rem);
        max-width: 52ch;
        margin-bottom: 2.5rem;
      }

      .links {
        display: flex;
        flex-wrap: wrap;
        gap: 0.75rem;
      }

      .links a {
        border: 1px solid var(--line);
        border-radius: 999px;
        padding: 0.5rem 1.125rem;
        font-size: 0.9375rem;
        color: var(--text-dim);
        transition: border-color 0.2s ease, color 0.2s ease, transform 0.2s ease;
      }

      .links a:hover {
        border-color: var(--accent-dim);
        color: var(--text);
        transform: translateY(-2px);
      }

      .meta {
        font-family: var(--mono);
        font-size: 0.8125rem;
        color: var(--text-dim);
        margin-top: 3rem;
      }
    `,
  ];

  render() {
    return html`
      <section id="top">
        <div class="glow"></div>
        <div class="wrap">
          <h1 data-reveal>
            ${profile.name} —<br /><span class="role">${profile.role}</span>
          </h1>
          <p class="tagline" data-reveal>${profile.tagline}</p>
          <div class="links" data-reveal>
            ${socials.map(
              (s) => html`<a href=${s.url} target="_blank" rel="noopener">${s.label}</a>`,
            )}
            ${profile.resumeUrl
              ? html`<a href=${profile.resumeUrl} download>Резюме</a>`
              : null}
          </div>
          <p class="meta" data-reveal>${profile.location}</p>
        </div>
      </section>
    `;
  }
}

customElements.define('hero-section', HeroSection);
