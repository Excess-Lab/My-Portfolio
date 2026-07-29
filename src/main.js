import { gsap } from 'gsap';

import './styles/main.css';
import './styles/about.css';
import './components/hero-tear.js';
import './components/about-screen.js';
import './components/cursor-trail.js';

const site = document.querySelector('#site');

/**
 * Рваный морф: новый экран проступает разорванным на полосы и на глазах
 * собирается. Смещение даёт тот же турбулентный шум, что изъедает края букв, —
 * переход говорит на языке сайта, а не выглядит стандартным затуханием.
 *
 * Запускается в момент, когда фигура на первом экране начинает распадаться:
 * распад и сборка нового экрана идут внахлёст, поэтому переход видно.
 */
function morphIn(screen) {
  const map = document.querySelector('#morph-tear-map');
  const noise = document.querySelector('#morph-tear-noise');
  const blur = document.querySelector('#morph-tear-blur');

  // Три величины разом: смещение рвёт картинку, размытие держит её нерезкой,
  // а меняющаяся частота шума заставляет разрыв шевелиться — искажение живое,
  // а не застывший узор.
  const state = { scale: 160, blur: 22, freqX: 0.004, freqY: 0.02 };

  const apply = () => {
    map?.setAttribute('scale', state.scale.toFixed(2));
    blur?.setAttribute('stdDeviation', state.blur.toFixed(2));
    noise?.setAttribute(
      'baseFrequency',
      `${state.freqX.toFixed(4)} ${state.freqY.toFixed(4)}`,
    );
  };

  screen.style.filter = 'url(#morph-tear)';
  apply();

  const tl = gsap.timeline({
    onUpdate: apply,
    onComplete: () => {
      // Фильтр снимаем: держать его на живом экране дорого и незачем.
      screen.style.filter = '';
      state.scale = 0;
      state.blur = 0;
      apply();
    },
  });

  tl.to(state, { scale: 0, duration: 1.45, ease: 'power3.out' }, 0)
    .to(state, { blur: 0, duration: 1.15, ease: 'power2.out' }, 0.1)
    // Частота гуляет вверх и обратно: рябь пробегает по картинке, пока она
    // собирается.
    .to(state, { freqX: 0.03, freqY: 0.07, duration: 0.55, ease: 'sine.inOut' }, 0)
    .to(state, { freqX: 0.006, freqY: 0.03, duration: 0.7, ease: 'sine.inOut' }, 0.55);

  gsap.fromTo(
    screen,
    { opacity: 0 },
    { opacity: 1, duration: 0.8, ease: 'power2.out' },
  );
}

/**
 * Переход на раздел.
 */
function openAbout({ morph = false } = {}) {
  site.hidden = false;

  if (!site.querySelector('about-screen')) {
    const screen = document.createElement('about-screen');
    site.append(screen);

    if (morph) morphIn(screen);
  }

  // Шлейф за курсором живёт на всём сайте, но не на первом экране: там курсор
  // занят хлястиком.
  if (!document.querySelector('cursor-trail')) {
    document.body.append(document.createElement('cursor-trail'));
  }

  // При переходе через отрыв первый экран не убираем: он лежит поверх и
  // растворяется сам, когда догорят частицы. А при прямом входе (?screen=about)
  // никакой анимации нет, и его надо снять сразу — иначе он навсегда останется
  // поверх раздела.
  if (!morph) document.querySelector('hero-tear')?.remove();
}

// Экраны переключаются целиком, без скролла между разделами: оторвали хлястик —
// попали на «обо мне». Остальные разделы встанут сюда же по мере готовности.
document.addEventListener('enter-site', () => openAbout({ morph: true }));

// Прямой вход для разработки и снятия скриншотов: ?screen=about пропускает
// первый экран. Вместе с ?wx= это позволяет открыть любое состояние.
if (new URLSearchParams(location.search).get('screen') === 'about') {
  openAbout();
}
