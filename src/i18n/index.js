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
  },
  en: {
    name: 'makar kabanov',
    role: 'product designer',
    posterFirst: 'makar',
    posterLast: 'kabanov',
    posterCase: 'case №1',
    tear: 'open',
    hint: 'pull the tab',
  },
  sr: {
    name: 'макар кабанов',
    role: 'дизајнер производа',
    posterFirst: 'макар',
    posterLast: 'кабанов',
    posterCase: 'случај №1',
    tear: 'отвори',
    hint: 'повуци језичак',
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
