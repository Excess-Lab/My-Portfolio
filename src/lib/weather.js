/**
 * Погода в Москве.
 *
 * Источник — open-meteo.com: бесплатно, без ключа и без бэкенда, то есть
 * работает прямо с GitHub Pages. Ответ сводится к небольшому набору состояний,
 * под которые дальше настраивается атмосфера сайта.
 */

const MOSCOW = { latitude: 55.7558, longitude: 37.6173 };

const ENDPOINT =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=${MOSCOW.latitude}&longitude=${MOSCOW.longitude}` +
  `&current=temperature_2m,weather_code,is_day&timezone=Europe%2FMoscow`;

// Кеш на полчаса: погода не меняется ежесекундно, а лишние запросы при
// переключении экранов ни к чему.
const CACHE_KEY = 'mk:weather';
const CACHE_TTL = 30 * 60 * 1000;

/**
 * Коды WMO → наши состояния. Группируем грубо: важно не метеорологическая
 * точность, а то, какую атмосферу включать на сайте.
 * @see https://open-meteo.com/en/docs
 */
function toCondition(code, isDay) {
  if (code === 0) return isDay ? 'sunny' : 'clear';
  if (code <= 2) return isDay ? 'sunny' : 'clear'; // малооблачно
  if (code === 3) return 'cloudy';
  if (code >= 45 && code <= 48) return 'fog';
  if (code >= 51 && code <= 67) return 'rain';
  if (code >= 71 && code <= 77) return 'snow';
  if (code >= 80 && code <= 82) return 'rain';
  if (code >= 85 && code <= 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'cloudy';
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (Date.now() - cached.at > CACHE_TTL) return null;
    return cached.value;
  } catch {
    return null;
  }
}

function writeCache(value) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), value }));
  } catch {
    // приватный режим — переживём
  }
}

/**
 * @typedef {{condition: string, temperature: number, isDay: boolean}} Weather
 * @returns {Promise<Weather>} бросает, если данных нет — вызывающий решает,
 *   что показывать
 */
export async function fetchWeather() {
  const cached = readCache();
  if (cached) return cached;

  // Тайм-аут: висящий запрос не должен держать интерфейс в состоянии загрузки.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(ENDPOINT, { signal: controller.signal });
    if (!response.ok) throw new Error(`open-meteo: ${response.status}`);

    const data = await response.json();
    const current = data.current;
    if (!current) throw new Error('open-meteo: пустой ответ');

    const value = {
      condition: toCondition(current.weather_code, current.is_day === 1),
      temperature: Math.round(current.temperature_2m),
      isDay: current.is_day === 1,
    };

    writeCache(value);
    return value;
  } finally {
    clearTimeout(timeout);
  }
}

/** Ключ перевода для подписи состояния. */
export function conditionKey(condition) {
  return `wx${condition[0].toUpperCase()}${condition.slice(1)}`;
}
