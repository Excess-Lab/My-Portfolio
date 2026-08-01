/**
 * Распад изображения на «атомы» и сборка их в новый экран.
 *
 * Картинка сэмплируется по сетке, каждая точка становится частицей. Сначала
 * частицы срываются и разлетаются, а затем — если передан targets — сходятся
 * к точкам будущего экрана: фигура не исчезает, а пересобирается в сайт.
 *
 * Рисуем не через тысячи fillRect, а прямой записью в ImageData — так двадцать
 * с лишним тысяч частиц держат 60fps.
 */

const MAX_SAMPLE_WIDTH = 560; // плотность сетки частиц, не размер на экране

/**
 * @param {HTMLCanvasElement} canvas куда рисуем (уже расположен поверх картинки)
 * @param {HTMLImageElement} image исходник (должен быть полностью загружен)
 * @param {object} options
 * @param {number} [options.duration] длительность, мс
 * @param {{x: number, y: number}[]} [options.targets] куда собираться, в
 *   координатах вьюпорта. Пусто — частицы просто растворяются
 * @param {(progress: number) => void} [options.onAssemble] прогресс сборки 0..1
 * @param {() => void} [options.onDone]
 */
export function atomize(
  canvas,
  image,
  { duration = 1900, targets = null, onAssemble, onDone } = {},
) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));

  // Канвас теперь во весь экран, а фигура занимает лишь его часть. Считаем,
  // куда именно она попадает: иначе частицы стартовали бы не оттуда, где она
  // была, и распад «съехал» бы относительно фотографии.
  const imageRect = image.getBoundingClientRect();
  const originX = (imageRect.left - rect.left) * dpr;
  const originY = (imageRect.top - rect.top) * dpr;
  const areaW = Math.max(1, imageRect.width * dpr);
  const areaH = Math.max(1, imageRect.height * dpr);

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    onDone?.();
    return () => {};
  }

  // Считываем пиксели с уменьшенной копии — этого хватает и это быстро.
  const sampleW = Math.min(MAX_SAMPLE_WIDTH, Math.round(areaW));
  const sampleH = Math.max(1, Math.round((sampleW * areaH) / areaW));
  const off = document.createElement('canvas');
  off.width = sampleW;
  off.height = sampleH;
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(image, 0, 0, sampleW, sampleH);
  const src = offCtx.getImageData(0, 0, sampleW, sampleH).data;

  const scaleX = areaW / sampleW;
  const scaleY = areaH / sampleH;

  // Частицы в плоских массивах: меньше нагрузка на GC, чем от массива объектов.
  const count = sampleW * sampleH;
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const vx = new Float32Array(count);
  const vy = new Float32Array(count);
  const delay = new Float32Array(count);
  const color = new Uint32Array(count);
  const size = new Float32Array(count);
  // Куда частица летит на сборке. Заполняется ниже из targets.
  const tx = new Float32Array(count);
  const ty = new Float32Array(count);
  let n = 0;

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const i = (y * sampleW + x) * 4;
      const a = src[i + 3];
      if (a < 12) continue; // прозрачный фон вокруг фигуры пропускаем

      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      px[n] = originX + x * scaleX;
      py[n] = originY + y * scaleY;

      // Разлёт: вверх и от вертикальной оси, с случайным разбросом.
      const fromCenter = (x / sampleW - 0.5) * 2;
      vx[n] = (fromCenter * 26 + (Math.random() - 0.5) * 30) * dpr;
      vy[n] = (-14 - Math.random() * 42) * dpr;

      // Снизу вверх — фигура «испаряется», а не взрывается целиком.
      delay[n] = (1 - y / sampleH) * 0.35 + Math.random() * 0.25;
      size[n] = Math.max(1, Math.round(scaleX * (0.7 + Math.random() * 0.5)));
      // ABGR: так пиксель ложится в Uint32 на little-endian (все актуальные платформы).
      color[n] = (b << 16) | (g << 8) | r;
      n++;
    }
  }

  // Раздаём цели. Точки берём по кругу, но со случайным сдвигом — иначе
  // соседние частицы уехали бы в одну и ту же точку строем.
  const assembling = Array.isArray(targets) && targets.length > 0;
  const canvasRect = canvas.getBoundingClientRect();

  if (assembling) {
    for (let i = 0; i < n; i++) {
      const point = targets[(i + ((Math.random() * targets.length) | 0)) % targets.length];
      // Цели приходят в координатах вьюпорта — переводим в пиксели канваса.
      tx[i] = (point.x - canvasRect.left) * dpr;
      ty[i] = (point.y - canvasRect.top) * dpr;
    }
  }

  // Доля времени на разлёт: дальше начинается сборка.
  const SCATTER = 0.42;

  // Доля сборки, за которую частица долетает до цели. Остаток — стоянка на
  // месте, пока под роем проявляется экран.
  const LANDED = 0.72;

  // Сплошная плитка: пока частица не сорвалась, она должна закрывать свою
  // клетку целиком. Со случайным размером между клетками зияли щели, и в первом
  // же кадре фигура заметно «дырявела» — подмену фотографии частицами было
  // видно. Целое число: дробный шаг оставлял ту же щель через раз.
  const tile = Math.max(1, Math.ceil(Math.max(scaleX, scaleY)));

  // Цвет, в который частица перекрашивается по дороге к цели: чернила сайта.
  // Кожа и чёрная футболка, сложенные в буквы, читались бы грязным пятном
  // поверх вёрстки; выцветая в цвет текста, рой садится в неё, а не на неё.
  const INK_R = 17;
  const INK_G = 17;
  const INK_B = 17;

  const frame = ctx.createImageData(w, h);
  const buf = new Uint32Array(frame.data.buffer);

  let raf = 0;
  let start = 0;
  let cancelled = false;

  function draw(now) {
    if (cancelled) return;
    if (!start) start = now;
    const elapsed = (now - start) / duration; // 0..1

    buf.fill(0);

    for (let i = 0; i < n; i++) {
      const local = (elapsed - delay[i]) / (1 - delay[i]);
      if (local <= 0) {
        // ещё не сорвалась — рисуем на месте, сплошной плиткой
        putPixel(buf, w, h, px[i], py[i], color[i], tile, 1);
        continue;
      }
      if (local >= 1) continue; // уже растворилась

      // Разлёт: ускоряется по мере удаления.
      const flight = Math.min(local, SCATTER);
      const eased = flight * flight;
      let x = px[i] + vx[i] * eased * 3;
      let y = py[i] + vy[i] * eased * 3 + 40 * dpr * eased * eased;
      let alpha = assembling ? 1 : 1 - local;
      let packed = color[i];
      let dot = size[i];

      if (assembling && local > SCATTER) {
        // Сборка: от точки, где частицу застал конец разлёта, к её цели.
        // Плавный старт и мягкое торможение — рой стягивается, а не схлопывается.
        //
        // Долетает частица к LANDED, а не к самому концу: остаток времени она
        // просто стоит на месте. Эта пауза и есть смысл перехода — сначала
        // складывается рой, и только из него проступает вёрстка. Пока сборка
        // шла до конца, интерфейс успевал появиться под ещё летящими
        // частицами, и выглядело наоборот: UI приехал, а рой к нему прилип.
        const u = (local - SCATTER) / (1 - SCATTER);
        const arrive = Math.min(1, u / LANDED);
        const k = arrive < 0.5
          ? 4 * arrive * arrive * arrive
          : 1 - Math.pow(-2 * arrive + 2, 3) / 2;

        x += (tx[i] - x) * k;
        y += (ty[i] - y) * k;

        // По дороге частица выцветает в цвет текста и мельчает: у цели садится
        // уже не кусок фотографии, а пиксель вёрстки — поэтому подмены не видно.
        const m = k * k;
        const r0 = packed & 255;
        const g0 = (packed >> 8) & 255;
        const b0 = (packed >> 16) & 255;
        packed =
          (((b0 + (INK_B - b0) * m) | 0) << 16) |
          (((g0 + (INK_G - g0) * m) | 0) << 8) |
          ((r0 + (INK_R - r0) * m) | 0);
        dot = Math.max(1, dot * (1 - 0.7 * k));

        // Гаснут уже стоя на месте, вместе с проявлением экрана под ними:
        // рой не улетает, а буквально становится вёрсткой.
        alpha = u > LANDED ? 1 - (u - LANDED) / (1 - LANDED) : 1;
      }

      putPixel(buf, w, h, x, y, packed, dot, alpha);
    }

    if (assembling && onAssemble) {
      onAssemble(Math.max(0, Math.min(1, (elapsed - SCATTER) / (1 - SCATTER))));
    }

    ctx.putImageData(frame, 0, 0);

    if (elapsed >= 1.05) {
      onDone?.();
      return;
    }
    raf = requestAnimationFrame(draw);
  }

  raf = requestAnimationFrame(draw);

  return function cancel() {
    cancelled = true;
    cancelAnimationFrame(raf);
  };
}

function putPixel(buf, w, h, fx, fy, packed, size, alpha) {
  const x0 = fx | 0;
  const y0 = fy | 0;
  const a = alpha >= 1 ? 255 : (alpha * 255) | 0;
  if (a <= 0) return;

  // Альфу кладём в старший байт (little-endian) — цвет уже упакован с 255.
  const value = (packed & 0x00ffffff) | (a << 24);

  for (let dy = 0; dy < size; dy++) {
    const y = y0 + dy;
    if (y < 0 || y >= h) continue;
    const row = y * w;
    for (let dx = 0; dx < size; dx++) {
      const x = x0 + dx;
      if (x < 0 || x >= w) continue;
      buf[row + x] = value;
    }
  }
}
