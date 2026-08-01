/**
 * Точки, в которые собираются частицы после распада.
 *
 * Берём реальные прямоугольники блоков будущего экрана и заполняем их сеткой
 * точек. Частицы садятся именно туда, где через мгновение окажется текст и
 * медиа, — поэтому кажется, что фигура пересобралась в сайт, а не растворилась,
 * уступив место следующему кадру.
 *
 * Плотность точек одинаковая по площади: большой блок получает больше частиц,
 * чем короткая строка, и силуэт раскладки читается верно.
 */

// Шаг сетки в пикселях вьюпорта. Мельче — точнее силуэт и дороже расчёт.
const STEP = 5;

// Потолок нужен только против совсем уж больших экранов. Скупиться нельзя:
// на редкой сетке севший рой читался пылью по странице, а не силуэтом
// раскладки — а именно из этого силуэта и должна проступить вёрстка.
const MAX_POINTS = 24000;

/**
 * @param {Element} root экран, чьи блоки станут мишенями
 * @returns {{x: number, y: number}[]} точки в координатах вьюпорта
 */
export function collectTargets(root) {
  if (!root) return [];

  // Берём то, из чего экран и состоит: подписи, заголовки, абзацы, медиа.
  const blocks = root.querySelectorAll(
    '.about__corner, .about__title, .about__text, .about__stack-label, .about__weather, .about__media, .site-nav',
  );

  const points = [];

  for (const block of blocks) {
    const rect = block.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;

    for (let y = rect.top; y < rect.bottom; y += STEP) {
      for (let x = rect.left; x < rect.right; x += STEP) {
        // Лёгкий разброс: строгая сетка выдала бы себя муаром.
        points.push({
          x: x + (Math.random() - 0.5) * STEP,
          y: y + (Math.random() - 0.5) * STEP,
        });
      }
    }
  }

  if (points.length <= MAX_POINTS) return points;

  // Прореживаем равномерно, а не срезаем хвост: иначе нижние блоки остались бы
  // без частиц.
  const stride = points.length / MAX_POINTS;
  const thinned = [];
  for (let i = 0; i < MAX_POINTS; i++) {
    thinned.push(points[Math.floor(i * stride)]);
  }
  return thinned;
}
