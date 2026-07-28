import './styles/main.css';
import './components/hero-tear.js';

// После разрыва хлястика уходим на основной сайт.
// Пока это просто белая страница — сюда встанут остальные секции.
document.addEventListener('enter-site', () => {
  const hero = document.querySelector('hero-tear');
  const site = document.querySelector('#site');

  site.hidden = false;
  document.body.style.overflow = 'auto';
  hero?.remove();
});
