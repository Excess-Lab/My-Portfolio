/**
 * Объёмные облака и туман на канвасе.
 *
 * Каждое облако — не контур, а горсть мягких сгустков (радиальных градиентов),
 * из которых складывается силуэт. Сгустки медленно дышат по своим фазам,
 * поэтому облако плывёт и на ходу меняет форму, а не едет картинкой.
 *
 * Белое облако на светло-сером холсте само по себе почти не читается, поэтому
 * под ним сначала кладётся мягкая серая тень со смещением вниз — она и даёт
 * объём, отделяя облако от фона.
 *
 * Канвас держим в пониженном разрешении и растягиваем стилями: апскейл сам по
 * себе даёт мягкость, которой от градиентов не добиться, и экономит отрисовку.
 */

const RESOLUTION = 0.5;

/**
 * Силуэт облака собирается заново при каждом запуске: число сгустков, их
 * положение и радиусы случайны, поэтому двух одинаковых облаков не бывает.
 * Держим лишь общую логику — крупные сгустки к середине, мелкие по краям,
 * низ ровнее верха: так силуэт читается облаком, а не кляксой.
 */
function makePuffs(random) {
  const count = 5 + Math.floor(random() * 3);
  const puffs = [];

  for (let i = 0; i < count; i++) {
    // Позиция по горизонтали — от левого края к правому с разбросом.
    const along = (i / (count - 1)) * 2 - 1;
    const centrality = 1 - Math.abs(along);

    puffs.push({
      dx: along * 0.46 + (random() - 0.5) * 0.1,
      // Середина вспухает вверх, края оседают вниз.
      dy: -0.2 * centrality + 0.1 * (1 - centrality) + (random() - 0.5) * 0.08,
      r: 0.26 + centrality * 0.2 + random() * 0.06,
      // Каждый сгусток дышит по своей фазе — отсюда живая, меняющаяся форма.
      phase: random() * Math.PI * 2,
      speed: 0.15 + random() * 0.25,
      amp: 0.02 + random() * 0.03,
      // Куда полетит этот сгусток, если облако разорвать кликом.
      flyX: (random() - 0.5) * 2.6,
      flyY: -0.4 - random() * 1.2,
      spin: (random() - 0.5) * 1.4,
    });
  }

  return puffs;
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {'cloudy'|'fog'} mode
 * @returns {() => void} остановка
 */
export function startSoftSky(canvas, mode) {
  const ctx = canvas.getContext('2d');
  const random = Math.random;
  const fog = mode === 'fog';

  const resize = () => {
    canvas.width = Math.max(1, Math.round(window.innerWidth * RESOLUTION));
    canvas.height = Math.max(1, Math.round(window.innerHeight * RESOLUTION));
  };
  resize();
  window.addEventListener('resize', resize);

  // Прогалина в тумане под курсором: туман будто расступается перед тобой.
  const hole = { x: -1, y: -1, radius: 0, target: 0 };
  const onPointer = (event) => {
    hole.x = event.clientX * RESOLUTION;
    hole.y = event.clientY * RESOLUTION;
    hole.target = 1;
  };
  const onLeave = () => {
    hole.target = 0;
  };

  // Курсор нужен обоим режимам: туману — чтобы расступаться, облакам — чтобы
  // реагировать на наведение и разлетаться по клику.
  const pointer = { x: -1, y: -1 };
  const trackPointer = (event) => {
    pointer.x = event.clientX * RESOLUTION;
    pointer.y = event.clientY * RESOLUTION;
    if (fog) onPointer(event);
  };
  const onDown = (event) => {
    const px = event.clientX * RESOLUTION;
    const py = event.clientY * RESOLUTION;
    const hit = pick(px, py);
    if (hit) hit.burst = 0.001;
  };

  window.addEventListener('pointermove', trackPointer, { passive: true });
  window.addEventListener('pointerleave', onLeave);
  if (!fog) window.addEventListener('pointerdown', onDown);

  // Облака идут редкой цепочкой, туман — сплошной пеленой из крупных пятен.
  const count = fog ? 7 : 9;
  const bodies = Array.from({ length: count }, (_, i) => ({
    // Ровный шаг с небольшим разбросом: облака идут постоянным потоком, без
    // пустых промежутков и без слипшихся куч.
    x: fog ? random() : -0.35 + ((i + random() * 0.6) / count) * 1.7,
    y: fog ? 0.2 + random() * 0.7 : 0.1 + (i / count) * 0.72,
    // Туман меряем долей экрана — он сплошной. Облаку нужен свой размер,
    // не зависящий от окна: иначе на большом мониторе оно вырастает в облачный
    // фронт и лезет на текст. Ширина облака выходит примерно 4.4 × size.
    size: fog ? 0.7 + random() * 0.7 : 42 + random() * 22,
    // Туман почти стоит на месте, облака заметно плывут.
    speed:
      (fog ? 0.004 + random() * 0.006 : 0.011 + random() * 0.013) *
      (fog && random() < 0.4 ? -1 : 1),
    alpha: fog ? 0.12 + random() * 0.08 : 0.62 + random() * 0.2,
    puffs: makePuffs(random),
    // Реакция на курсор: наведение подсвечивает и распушает, клик разрывает.
    hover: 0,
    burst: 0,
  }));

  /** Какое облако под точкой. Радиус берём по силуэту: ширина ≈ 4.4 × size. */
  function pick(px, py) {
    if (fog) return null;
    const w = canvas.width;
    const h = canvas.height;

    for (const body of bodies) {
      if (body.burst) continue;
      const dx = px - body.x * w;
      const dy = py - body.y * h;
      // По горизонтали облако шире, чем по вертикали — проверяем эллипсом.
      const rx = body.size * 1.5;
      const ry = body.size * 0.75;
      if ((dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1) return body;
    }
    return null;
  }

  // Полоса света, медленно проходящая сквозь туман: он от неё будто светлеет.
  let beam = 0.2;
  let raf = 0;
  let last = performance.now();

  /** Один проход по сгусткам облака: цветом и смещением управляет вызывающий. */
  function paintBody(body, t, size, cx, cy, color, offsetY, alphaScale) {
    // Разлёт ускоряется: сначала облако вспухает, потом клочья расходятся.
    const fly = body.burst * body.burst;

    for (const puff of body.puffs) {
      const breathe = Math.sin(t * puff.speed + puff.phase) * puff.amp;
      // Наведение слегка распушает облако, клик разносит клочья в стороны.
      const swell = 1 + body.hover * 0.12 + fly * 0.5;
      const px =
        cx + (puff.dx + breathe) * size * 2 + puff.flyX * fly * size * 2.4;
      const py =
        cy + (puff.dy + breathe * 0.6) * size + offsetY + puff.flyY * fly * size * 1.8;
      const pr = Math.max(1, (puff.r + breathe) * size * swell);
      // Разлетаясь, клочья тают; под курсором облако, наоборот, ярче.
      const alpha = body.alpha * alphaScale * (1 + body.hover * 0.3) * (1 - body.burst);

      const gradient = ctx.createRadialGradient(px, py, 0, px, py, pr);
      gradient.addColorStop(0, `rgba(${color},${alpha})`);
      gradient.addColorStop(0.5, `rgba(${color},${alpha * 0.6})`);
      gradient.addColorStop(1, `rgba(${color},0)`);

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function frame(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;

    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const t = now / 1000;

    const hovered = pick(pointer.x, pointer.y);

    for (const body of bodies) {
      body.x += body.speed * dt;

      // Ушло за край — возвращается с другой стороны новым: другой силуэт,
      // высота и размер. Поток идёт непрерывно и не повторяется.
      if (body.x > 1.35 || body.x < -0.35) {
        body.x = body.speed > 0 ? -0.35 : 1.35;
        if (!fog) {
          body.y = 0.08 + random() * 0.76;
          body.size = 42 + random() * 22;
          body.puffs = makePuffs(random);
        }
      }

      // Наведение подтягивается плавно — облако оживает, а не дёргается.
      const wantHover = body === hovered ? 1 : 0;
      body.hover += (wantHover - body.hover) * Math.min(1, dt * 6);

      if (body.burst) {
        body.burst = Math.min(1, body.burst + dt * 0.9);
        if (body.burst >= 1) {
          // Разлетевшееся облако собирается заново за краем экрана — небо не
          // должно пустеть после нескольких кликов.
          body.burst = 0;
          body.hover = 0;
          body.x = body.speed > 0 ? -0.35 : 1.35;
          body.y = 0.1 + random() * 0.72;
          body.size = 42 + random() * 22;
          body.puffs = makePuffs(random);
        }
      }

      const cx = body.x * w;
      const cy = body.y * h;
      // Туман меряется долей экрана, облако — уже в пикселях канваса.
      const size = fog ? body.size * Math.min(w, h) * 1.6 : body.size;

      if (!fog) {
        // Тень снизу — то, что делает облако объёмным, а не белёсым пятном.
        paintBody(body, t, size, cx, cy, '90,92,96', size * 0.16, 0.5);
      }
      paintBody(body, t, size, cx, cy, '255,255,255', 0, 1);
    }

    if (fog) {
      // Проход света: широкая мягкая полоса, идущая поперёк пелены.
      beam += dt * 0.045;
      if (beam > 1.4) beam = -0.4;

      const bx = beam * w;
      const gradient = ctx.createLinearGradient(bx - w * 0.35, 0, bx + w * 0.35, h);
      gradient.addColorStop(0, 'rgba(255,255,255,0)');
      gradient.addColorStop(0.5, 'rgba(255,255,255,0.16)');
      gradient.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Прогалина: вырезаем туман вокруг курсора. Радиус подтягивается плавно,
      // поэтому туман расступается и сходится обратно, а не моргает.
      hole.radius += (hole.target - hole.radius) * Math.min(1, dt * 3);
      if (hole.radius > 0.01 && hole.x >= 0) {
        const r = Math.min(w, h) * 0.28 * hole.radius;
        const clear = ctx.createRadialGradient(hole.x, hole.y, 0, hole.x, hole.y, r);
        clear.addColorStop(0, 'rgba(0,0,0,1)');
        clear.addColorStop(0.55, 'rgba(0,0,0,0.55)');
        clear.addColorStop(1, 'rgba(0,0,0,0)');

        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = clear;
        ctx.beginPath();
        ctx.arc(hole.x, hole.y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }

    raf = requestAnimationFrame(frame);
  }

  raf = requestAnimationFrame(frame);

  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener('resize', resize);
    window.removeEventListener('pointermove', trackPointer);
    window.removeEventListener('pointerleave', onLeave);
    window.removeEventListener('pointerdown', onDown);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };
}
