import { gsap } from 'gsap';

import './styles/main.css';
import './styles/about.css';
import './styles/nav.css';
import './styles/cases.css';
import './styles/ideas.css';
import './components/hero-tear.js';
import './components/about-screen.js';
import './components/cases-screen.js';
import './components/archive-screen.js';
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

// Разделы: ключ меню → тег экрана. Новый раздел добавляется одной строкой.
const SCREENS = {
  about: 'about-screen',
  cases: 'cases-screen',
  archive: 'archive-screen',
};

/**
 * Показать раздел. Экраны сменяются целиком, без скролла между ними.
 */
function showScreen(section, { morph = false, hidden = false } = {}) {
  const tag = SCREENS[section];
  if (!tag) return;

  site.hidden = false;

  // Прошлый экран убираем сразу: держать оба в DOM незачем, а видео и канвасы
  // на скрытом экране продолжали бы жрать кадры.
  if (!site.querySelector(tag)) {
    const screen = document.createElement(tag);
    // При переходе с первого экрана раздел создаётся невидимым: его проявляют
    // частицы по мере того, как садятся по местам его блоков.
    if (hidden) screen.style.opacity = '0';
    site.replaceChildren(screen);
    if (morph) morphIn(screen);
  }

  // Шлейф за курсором живёт на всём сайте, но не на первом экране: там курсор
  // занят хлястиком.
  if (!document.querySelector('cursor-trail')) {
    document.body.append(document.createElement('cursor-trail'));
  }

  // Первый экран убираем только при прямом входе (?screen=…), где никакой
  // анимации нет и он бы навсегда остался поверх раздела.
  //
  // При переходе через отрыв его трогать нельзя: именно в нём живёт канвас с
  // частицами, и удаление здесь уничтожало распад до того, как он начнётся.
  // Экран снимет себя сам, когда частицы соберутся.
  if (!morph && !hidden) document.querySelector('hero-tear')?.remove();
}

// Меню просит другой раздел — показываем его с тем же рваным морфом, что и
// переход с первого экрана: смена раздела говорит на том же языке.
document.addEventListener('navigate', (event) => {
  showScreen(event.detail, { morph: true });
});

// Экраны переключаются целиком, без скролла между разделами: оторвали хлястик —
// попали на «обо мне». Остальные разделы встанут сюда же по мере готовности.
// С первого экрана раздел не морфится, а собирается из частиц: фигура
// рассыпается и складывается в блоки сайта. Проявлением управляет hero-tear.
document.addEventListener('enter-site', () => showScreen('about', { hidden: true }));

// Прямой вход для разработки и снятия скриншотов: ?screen=about пропускает
// первый экран. Вместе с ?wx= это позволяет открыть любое состояние.
const params = new URLSearchParams(location.search);
const requested = params.get('screen');
if (requested && SCREENS[requested]) {
  showScreen(requested);
}

// ?tear=auto — отрывает хлястик сам. Нужно, чтобы смотреть переход, не дёргая
// его руками каждый раз.
if (params.get('tear') === 'auto') {
  const hero = document.querySelector('hero-tear');
  hero?.updateComplete.then(() => {
    hero._paint(1);
    hero._finishTear();
  });
}
