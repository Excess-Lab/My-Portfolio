/**
 * Распад изображения на «атомы».
 *
 * Картинка сэмплируется по сетке, каждая точка становится частицей и разлетается
 * вверх-в-стороны с затуханием. Рисуем не через тысячи fillRect, а прямой
 * записью в ImageData — так 20–40 тысяч частиц держат 60fps.
 */

const MAX_SAMPLE_WIDTH = 560; // плотность сетки частиц, не размер на экране

/**
 * @param {HTMLCanvasElement} canvas куда рисуем (уже расположен поверх картинки)
 * @param {HTMLImageElement} image исходник (должен быть полностью загружен)
 * @param {{duration?: number, onDone?: () => void}} options
 */
export function atomize(canvas, image, { duration = 1900, onDone } = {}) {
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));

  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d', { alpha: true });
  if (!ctx) {
    onDone?.();
    return () => {};
  }

  // Считываем пиксели с уменьшенной копии — этого хватает и это быстро.
  const sampleW = Math.min(MAX_SAMPLE_WIDTH, w);
  const sampleH = Math.max(1, Math.round((sampleW * h) / w));
  const off = document.createElement('canvas');
  off.width = sampleW;
  off.height = sampleH;
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  offCtx.drawImage(image, 0, 0, sampleW, sampleH);
  const src = offCtx.getImageData(0, 0, sampleW, sampleH).data;

  const scaleX = w / sampleW;
  const scaleY = h / sampleH;

  // Частицы в плоских массивах: меньше нагрузка на GC, чем от массива объектов.
  const count = sampleW * sampleH;
  const px = new Float32Array(count);
  const py = new Float32Array(count);
  const vx = new Float32Array(count);
  const vy = new Float32Array(count);
  const delay = new Float32Array(count);
  const color = new Uint32Array(count);
  const size = new Float32Array(count);
  let n = 0;

  for (let y = 0; y < sampleH; y++) {
    for (let x = 0; x < sampleW; x++) {
      const i = (y * sampleW + x) * 4;
      const a = src[i + 3];
      if (a < 12) continue; // прозрачный фон вокруг фигуры пропускаем

      const r = src[i];
      const g = src[i + 1];
      const b = src[i + 2];

      px[n] = x * scaleX;
      py[n] = y * scaleY;

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
        // ещё не сорвалась — рисуем на месте
        putPixel(buf, w, h, px[i], py[i], color[i], size[i], 1);
        continue;
      }
      if (local >= 1) continue; // уже растворилась

      const eased = local * local; // ускоряется по мере разлёта
      const x = px[i] + vx[i] * eased * 3;
      const y = py[i] + vy[i] * eased * 3 + 40 * dpr * eased * eased;
      const alpha = 1 - local;
      putPixel(buf, w, h, x, y, color[i], size[i], alpha);
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
