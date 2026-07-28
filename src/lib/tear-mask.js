/**
 * Маска разрыва по рваному краю.
 *
 * Бумага не режется по линейке: край рвётся зубцами, потому что идёт по волокну.
 * Профиль генерируется один раз и дальше только сдвигается вместе с разрывом —
 * поэтому зубцы не «кипят» от кадра к кадру, а выглядят как один и тот же надрыв.
 */

/**
 * @param {number} segments сколько узлов по высоте полосы
 * @returns {{y: number, dx: number}[]} профиль в процентах
 */
export function createTearProfile(segments = 8) {
  const points = [];

  for (let i = 0; i <= segments; i++) {
    const y = (i / segments) * 100;

    // Мелкая пила — волокна, плюс редкие крупные зубцы там, где бумага
    // отрывается кусками.
    const fibers = (Math.random() - 0.5) * 1.9;
    const chunk = Math.random() < 0.22 ? (Math.random() - 0.5) * 4.2 : 0;
    // Разрыв идёт чуть наискось: снизу отстаёт от верха.
    const lean = (i / segments - 0.5) * 1.1;

    points.push({ y, dx: fibers + chunk + lean });
  }

  return points;
}

/**
 * Клип для уцелевшей части полосы: всё левее рваного края.
 *
 * @param {{y: number, dx: number}[]} profile
 * @param {number} cut положение разрыва, % от ширины
 */
export function remainingClip(profile, cut) {
  const edge = profile
    .map((p) => `${(cut + p.dx).toFixed(2)}% ${p.y.toFixed(2)}%`)
    .join(', ');
  return `polygon(0% 0%, ${edge}, 0% 100%)`;
}

/**
 * Профиль горизонтальной линии отрыва — той, что остаётся на самой бумаге.
 * Отклонения хранятся в пикселях макета, чтобы один и тот же край можно было
 * положить и на постер, и на оторванный кусок: у них разная высота, а зубцы
 * должны совпадать.
 *
 * @param {number} segments
 * @returns {{x: number, dy: number}[]} x в процентах, dy в px макета
 */
export function createBandProfile(segments = 26) {
  const points = [];

  for (let i = 0; i <= segments; i++) {
    const x = (i / segments) * 100;

    const fibers = (Math.random() - 0.5) * 3.4;
    const chunk = Math.random() < 0.16 ? (Math.random() - 0.5) * 7 : 0;

    points.push({ x, dy: fibers + chunk });
  }

  return points;
}

/**
 * Силуэт бумаги, с которой сорвали верхнюю ленту: слева край ещё целый,
 * справа от разрыва идёт рваная кромка.
 *
 * @param {{x: number, dy: number}[]} profile
 * @param {number} cut положение разрыва, % ширины
 * @param {number} bandY линия отрыва, % высоты
 * @param {number} heightPx высота элемента в px макета — для перевода dy в %
 */
export function tornSheetClip(profile, cut, bandY, heightPx) {
  const toPercent = (dy) => (dy / heightPx) * 100;

  const edge = profile
    .filter((p) => p.x >= cut)
    .map((p) => `${p.x.toFixed(2)}% ${(bandY + toPercent(p.dy)).toFixed(2)}%`);

  // Ровный край слева от разрыва — там бумага ещё не тронута.
  return `polygon(0% 0%, ${cut.toFixed(2)}% 0%, ${cut.toFixed(2)}% ${bandY.toFixed(
    2,
  )}%, ${edge.join(', ')}, 100% 100%, 0% 100%)`;
}

/**
 * Клип для узкой полоски надорванного слоя под хлястиком: лента идёт ровно по
 * тому же краю, что и сама полоса, поэтому рваный контур совпадает.
 *
 * @param {{y: number, dx: number}[]} profile
 * @param {number} cut положение разрыва, % от ширины
 * @param {number} width ширина видимой ленты, % от ширины полосы
 */
export function edgeClip(profile, cut, width = 3.4) {
  const right = profile
    .map((p) => `${(cut + p.dx).toFixed(2)}% ${p.y.toFixed(2)}%`)
    .join(', ');
  const left = [...profile]
    .reverse()
    .map((p) => `${(cut + p.dx - width).toFixed(2)}% ${p.y.toFixed(2)}%`)
    .join(', ');
  return `polygon(${right}, ${left})`;
}
