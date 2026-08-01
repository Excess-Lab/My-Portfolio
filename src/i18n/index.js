/**
 * Мини-i18n без зависимостей: словарь + подписка на смену языка.
 * Компоненты вызывают t('ключ') и перерисовываются по событию 'languagechange'.
 */

export const LOCALES = [
  { code: 'ru', label: 'русский', htmlLang: 'ru' },
  { code: 'en', label: 'english', htmlLang: 'en' },
  { code: 'sr', label: 'Српски', htmlLang: 'sr' },
];

const dict = {
  ru: {
    name: 'макар кабанов',
    role: 'продуктовый дизайнер',
    posterFirst: 'макар',
    posterLast: 'кабанов',
    posterCase: 'дело №1',
    tear: 'открыть',
    hint: 'потяни за язычок',

    about: 'обо мне',
    aboutText:
      'я дизайнер, который работает на стыке ui/ux, брендинга и цифровых продуктов. создаю интерфейсы, визуальные системы и концепции, где дизайн решает реальные задачи пользователя и бизнеса',
    stack: 'стек',
    cases: 'кейсы',
    archive: 'архив идей',
    gallery: 'галерея',
    contacts: 'контакты',
    city: 'москва',
    weatherLoading: '—',
    weatherFailed: 'нет связи',
    // Погода: ключи совпадают с кодами WMO, сгруппированными в lib/weather.js
    wxClear: 'ясно',
    wxSunny: 'солнечно',
    wxCloudy: 'облачно',
    wxFog: 'туман',
    wxRain: 'дождь',
    wxSnow: 'снег',
    wxStorm: 'гроза',
    menuShow: 'открыть',
    menuHide: 'закрыть',
    menuList: 'список',
    search: 'поиск по проектам',
    searchEmpty: 'ничего не нашлось',
    casesCount: 'проектов',
    searchIdeas: 'поиск по мыслям',
    ideasCount: 'мыслей',
    ideaRead: 'прочитать',
    ideaHide: 'свернуть',
  },
  en: {
    name: 'makar kabanov',
    role: 'product designer',
    posterFirst: 'makar',
    posterLast: 'kabanov',
    posterCase: 'case №1',
    tear: 'open',
    hint: 'pull the tab',

    about: 'about me',
    aboutText:
      'i am a designer working where ui/ux, branding and digital products meet. i build interfaces, visual systems and concepts in which design solves real problems for the user and the business',
    stack: 'stack',
    cases: 'cases',
    archive: 'idea archive',
    gallery: 'gallery',
    contacts: 'contacts',
    city: 'moscow',
    weatherLoading: '—',
    weatherFailed: 'no signal',
    wxClear: 'clear',
    wxSunny: 'sunny',
    wxCloudy: 'cloudy',
    wxFog: 'fog',
    wxRain: 'rain',
    wxSnow: 'snow',
    wxStorm: 'thunderstorm',
    menuShow: 'open',
    menuHide: 'close',
    menuList: 'list',
    search: 'search projects',
    searchEmpty: 'nothing found',
    casesCount: 'projects',
    searchIdeas: 'search notes',
    ideasCount: 'notes',
    ideaRead: 'read',
    ideaHide: 'collapse',
  },
  sr: {
    name: 'макар кабанов',
    role: 'дизајнер производа',
    posterFirst: 'макар',
    posterLast: 'кабанов',
    posterCase: 'случај №1',
    tear: 'отвори',
    hint: 'повуци језичак',

    about: 'о мени',
    aboutText:
      'ја сам дизајнер који ради на споју ui/ux-а, брендинга и дигиталних производа. правим интерфејсе, визуелне системе и концепте у којима дизајн решава стварне проблеме корисника и бизниса',
    stack: 'алати',
    cases: 'радови',
    archive: 'архива идеја',
    gallery: 'галерија',
    contacts: 'контакт',
    city: 'москва',
    weatherLoading: '—',
    weatherFailed: 'нема везе',
    wxClear: 'ведро',
    wxSunny: 'сунчано',
    wxCloudy: 'облачно',
    wxFog: 'магла',
    wxRain: 'киша',
    wxSnow: 'снег',
    wxStorm: 'грмљавина',
    menuShow: 'отвори',
    menuHide: 'затвори',
    menuList: 'листу',
    search: 'претрага пројеката',
    searchEmpty: 'ништа није нађено',
    casesCount: 'пројеката',
    searchIdeas: 'претрага мисли',
    ideasCount: 'мисли',
    ideaRead: 'прочитај',
    ideaHide: 'сажми',
  },
};

const STORAGE_KEY = 'mk:lang';
const FALLBACK = 'ru';

function detect() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved && dict[saved]) return saved;
  } catch {
    // приватный режим — просто идём дальше
  }
  const nav = (navigator.language || '').slice(0, 2).toLowerCase();
  return dict[nav] ? nav : FALLBACK;
}

let current = detect();

export function getLang() {
  return current;
}

export function setLang(code) {
  if (!dict[code] || code === current) return;
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    // не критично
  }
  document.documentElement.lang =
    LOCALES.find((l) => l.code === code)?.htmlLang ?? code;
  window.dispatchEvent(new CustomEvent('languagechange', { detail: code }));
}

export function t(key) {
  return dict[current][key] ?? dict[FALLBACK][key] ?? key;
}

export function onLanguageChange(handler) {
  window.addEventListener('languagechange', handler);
  return () => window.removeEventListener('languagechange', handler);
}

// Синхронизируем <html lang> с определившимся языком ещё до первого рендера.
document.documentElement.lang =
  LOCALES.find((l) => l.code === current)?.htmlLang ?? current;
