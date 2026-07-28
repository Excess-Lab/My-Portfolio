/**
 * Звук разрыва бумаги.
 *
 * По умолчанию синтезируется на Web Audio: отфильтрованный шум, громкость и
 * тембр которого зависят от скорости протягивания — тянешь медленно, бумага
 * потрескивает; дёрнул резко — рвётся с треском. Никаких файлов не нужно.
 *
 * Если положить настоящий сэмпл в public/sfx/tear.mp3, он подхватится
 * автоматически и будет проигрываться вместо синтеза (скорость управляет
 * playbackRate и громкостью).
 */

const SAMPLE_URL = `${import.meta.env.BASE_URL}sfx/tear.mp3`;

export class TearSound {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.buffer = null; // сэмпл, если найден
    this.noise = null;
    this.filter = null;
    this.gain = null;
    this.sampleNode = null;
    this.enabled = true;
  }

  /** Аудио можно заводить только после жеста пользователя — вызываем на pointerdown. */
  async unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') await this.ctx.resume();
      return;
    }

    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) {
      this.enabled = false;
      return;
    }

    this.ctx = new Ctx();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    // Пробуем найти сэмпл. Нет файла — молча остаёмся на синтезе.
    try {
      const res = await fetch(SAMPLE_URL);
      if (res.ok) {
        const bytes = await res.arrayBuffer();
        this.buffer = await this.ctx.decodeAudioData(bytes);
      }
    } catch {
      this.buffer = null;
    }
  }

  /** Начало разрыва: запускаем непрерывный источник. */
  start() {
    if (!this.enabled || !this.ctx) return;

    if (this.buffer) {
      this.sampleNode = this.ctx.createBufferSource();
      this.sampleNode.buffer = this.buffer;
      this.sampleNode.loop = true;
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.sampleNode.connect(this.gain).connect(this.master);
      this.sampleNode.start();
      return;
    }

    this.noise = this.ctx.createBufferSource();
    this.noise.buffer = this.#noiseBuffer();
    this.noise.loop = true;

    // Полосовой фильтр даёт «бумажный» призвук вместо белого шипения.
    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'bandpass';
    this.filter.frequency.value = 2200;
    this.filter.Q.value = 0.7;

    this.gain = this.ctx.createGain();
    this.gain.gain.value = 0;

    this.noise.connect(this.filter).connect(this.gain).connect(this.master);
    this.noise.start();
  }

  /**
   * Обновление по ходу перетаскивания.
   * @param {number} speed  скорость в px/кадр
   * @param {number} progress 0..1 — насколько оторван хлястик
   */
  update(speed, progress) {
    if (!this.enabled || !this.ctx || !this.gain) return;

    const intensity = Math.min(1, Math.abs(speed) / 26);
    const now = this.ctx.currentTime;

    if (this.buffer && this.sampleNode) {
      this.gain.gain.setTargetAtTime(0.25 + intensity * 0.75, now, 0.02);
      this.sampleNode.playbackRate.setTargetAtTime(0.8 + intensity * 0.7, now, 0.05);
      return;
    }

    if (!this.filter) return;
    // Тише в самом начале и в конце — разрыв «затухает» к краю листа.
    const edge = Math.sin(Math.PI * Math.min(1, Math.max(0, progress)));
    this.gain.gain.setTargetAtTime(intensity * (0.12 + 0.5 * edge), now, 0.015);
    this.filter.frequency.setTargetAtTime(1500 + intensity * 3200, now, 0.03);
    this.filter.Q.setTargetAtTime(0.5 + intensity * 3, now, 0.05);
  }

  /** Финальный «чпок» в момент, когда хлястик оторвался. */
  snap() {
    if (!this.enabled || !this.ctx) return;
    const now = this.ctx.currentTime;

    const src = this.ctx.createBufferSource();
    src.buffer = this.#noiseBuffer(0.35);

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3600, now);
    filter.frequency.exponentialRampToValueAtTime(700, now + 0.3);
    filter.Q.value = 1.2;

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

    src.connect(filter).connect(gain).connect(this.master);
    src.start(now);
    src.stop(now + 0.35);
  }

  /** Конец жеста: глушим непрерывный источник. */
  stop() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (this.gain) this.gain.gain.setTargetAtTime(0, now, 0.04);

    const nodes = [this.noise, this.sampleNode].filter(Boolean);
    for (const node of nodes) {
      try {
        node.stop(now + 0.2);
      } catch {
        // уже остановлен
      }
    }

    this.noise = null;
    this.sampleNode = null;
    this.filter = null;
    this.gain = null;
  }

  #noiseBuffer(seconds = 2) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    // Слегка «рваный» шум: редкие всплески поверх ровного — ближе к волокнам бумаги.
    for (let i = 0; i < len; i++) {
      const base = Math.random() * 2 - 1;
      const crackle = Math.random() < 0.04 ? (Math.random() * 2 - 1) * 2.5 : 0;
      data[i] = Math.max(-1, Math.min(1, base * 0.4 + crackle));
    }
    return buf;
  }
}
