/**
 * Кейсы.
 *
 * Единственное место, где правится содержимое раздела: компонент только
 * раскладывает то, что здесь описано. Чтобы добавить проект — допиши объект,
 * ничего больше трогать не нужно.
 *
 * Поля:
 *   id          — короткий латинский идентификатор, попадает в вёрстку
 *   year        — год, показывается рядом с категорией
 *   category    — ключ категории из CATEGORIES ниже
 *   preview     — файл превью в public/cases/. Картинка или видео: расширение
 *                 определяет, чем оно отрисуется, отдельного флага не нужно
 *   title       — название по языкам. Можно строкой — тогда оно одинаковое
 *                 везде; объектом — переводится вместе с сайтом
 *   description — описание по языкам. Достаточно ru; если перевода нет,
 *                 подставится русский
 *   link        — необязательная внешняя ссылка
 */

export const CATEGORIES = {
  product: { ru: 'продукт', en: 'product', sr: 'производ' },
  brand: { ru: 'брендинг', en: 'branding', sr: 'брендинг' },
  web: { ru: 'сайт', en: 'website', sr: 'сајт' },
  motion: { ru: 'моушн', en: 'motion', sr: 'моушн' },
  research: { ru: 'исследование', en: 'research', sr: 'истраживање' },
};

export const CASES = [
  {
    id: 'drinkit-taste-profile',
    year: '2025',
    category: 'product',
    preview: 'cases/drinkit-taste-profile.jpg',
    title: {
      ru: 'концепт фичи «вкусовой профиль» для приложения drinkit',
      en: 'concept of the “user taste profile” feature for the drinkit app',
      sr: 'концепт функције «укусни профил» за апликацију drinkit',
    },
    description: {
      ru: 'персональные рекомендации напитков по оценкам после покупки — через брендового персонажа.',
      en: 'personalised drink recommendations from post-purchase ratings, delivered by a brand character.',
    },
    link: 'https://dprofile.ru/case/179455/concept-of-the-user-taste-profile-feature-for-the-drinkit-app',
  },
  {
    id: 'case-one',
    year: '2026',
    category: 'product',
    preview: 'cases/placeholder-1.jpg',
    title: 'название проекта',
    description: {
      ru: 'одно-два предложения: что это за проект, какую задачу решал и что в нём интересного. текст заменишь на свой.',
      en: 'a sentence or two: what the project is, what problem it solved and what makes it interesting.',
      sr: 'реченица или две: шта је пројекат, који проблем решава и шта је у њему занимљиво.',
    },
  },
  {
    id: 'case-two',
    year: '2025',
    category: 'brand',
    preview: 'cases/placeholder-2.jpg',
    title: 'второй проект',
    description: {
      ru: 'здесь встанет описание второго проекта. хорошо заходит формула: контекст, что сделал, результат.',
    },
  },
  {
    id: 'case-three',
    year: '2025',
    category: 'web',
    preview: 'cases/placeholder-3.jpg',
    title: 'третий проект',
    description: {
      ru: 'если проектов меньше — просто удали лишние объекты из этого массива.',
    },
  },
];

/** Расширение решает, чем рисовать превью: отдельный флаг в данных не нужен. */
export function isVideo(preview) {
  return /\.(mp4|webm|mov)$/i.test(preview);
}
