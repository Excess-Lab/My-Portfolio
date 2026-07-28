// Единственное место, где правится текст сайта. Компоненты только рендерят это.

export const profile = {
  name: 'Makar K',
  role: 'Frontend-разработчик',
  tagline: 'Собираю быстрые интерфейсы на веб-компонентах и слежу, чтобы анимация не мешала читать.',
  location: 'Россия · удалённо',
  email: 'hello@example.com',
  resumeUrl: '', // положи PDF в public/ и укажи './cv.pdf'
};

export const about = [
  'Здесь пара абзацев о себе: чем занимаешься, что тебе интересно в вебе, какие задачи ищешь.',
  'Второй абзац — про подход к работе, любимые инструменты или чем занимаешься вне кода.',
];

export const socials = [
  { label: 'GitHub', url: 'https://github.com/Excess-Lab' },
  { label: 'Telegram', url: 'https://t.me/username' },
  { label: 'Email', url: 'mailto:hello@example.com' },
];

export const projects = [
  {
    title: 'Название проекта',
    year: '2026',
    description: 'Одно-два предложения: что это, какую задачу решает, что в нём интересного технически.',
    stack: ['Lit', 'Vite', 'GSAP'],
    links: [
      { label: 'Демо', url: '#' },
      { label: 'Код', url: '#' },
    ],
  },
  {
    title: 'Второй проект',
    year: '2025',
    description: 'Замени на реальный кейс. Хорошо заходит формула: контекст → что сделал → результат.',
    stack: ['TypeScript', 'Node'],
    links: [{ label: 'Код', url: '#' }],
  },
  {
    title: 'Третий проект',
    year: '2025',
    description: 'Если проектов меньше трёх — просто удали лишние объекты из этого массива.',
    stack: ['CSS', 'Canvas'],
    links: [{ label: 'Демо', url: '#' }],
  },
];

export const skills = [
  { group: 'Языки', items: ['JavaScript', 'TypeScript', 'HTML', 'CSS'] },
  { group: 'Фронтенд', items: ['Lit / Web Components', 'GSAP', 'Vite'] },
  { group: 'Инструменты', items: ['Git', 'Figma', 'GitHub Actions'] },
];

export const nav = [
  { label: 'Обо мне', href: '#about' },
  { label: 'Проекты', href: '#projects' },
  { label: 'Стек', href: '#skills' },
  { label: 'Контакты', href: '#contact' },
];
