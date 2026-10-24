import { LitElement, html } from 'lit';
import { createRef, ref } from 'lit/directives/ref.js';
import { gsap } from 'gsap';
import { Draggable } from 'gsap/Draggable';

import { LOCALES, getLang, setLang, t, onLanguageChange } from '../i18n/index.js';
import { TearSound } from '../lib/tear-sound.js';
import { atomize } from '../lib/atomize.js';
import { collectTargets } from '../lib/assemble-targets.js';
import { dropPaper, SheetPendulum } from '../lib/paper-physics.js';
import {
  createTearProfile,
  createBandProfile,
  remainingClip,
  edgeClip,
  tornSheetClip,
} from '../lib/tear-mask.js';

// Импортом, а не путём из public: Vite сам подставит корректный URL и на
// github.io/My-Portfolio/, и на кастомном домене.
import personUrl from '../assets/hero-person.png';
import stripUrl from '../assets/strip.svg';
import stripTabUrl from '../assets/strip-tab.svg';

gsap.registerPlugin(Draggable);

// Координаты из макета (1920×1080), пересчитанные в проценты от кадра с фото
// (1086×1080). Благодаря этому постер остаётся в руках на любом экране.
const POSTER = { left: 37.38, top: 35.83, width: 26.34, height: 34.9 };
const STRIP = { left: 37.38, top: 39.54, width: 29.93 };
// Отрыв засчитывается только когда язычок дотянут до самого конца полосы.
// Чуть меньше единицы — чтобы не зависеть от округления субпикселей.
const TEAR_COMPLETE = 0.995;
// С запасом: «open» втрое короче «открыть», и при фиксированном числе повторов
// на английском полоса не добивалась до язычка. Лишнее срезает overflow.
const TAB_REPEATS = 24;

// Геометрия отрыва в px макета: постер 377 высотой, хлястик начинается на 40-й
// точке и сам 20 высотой — значит лента отрывается по линии 60px от верха.
const POSTER_H = 377;
const BAND_H = 60;
const BAND_Y = (BAND_H / POSTER_H) * 100;

class HeroTear extends LitElement {
  // Светлый DOM: Tailwind-классы не проходят сквозь границу shadow root.
  createRenderRoot() {
    return this;
  }

  static properties = {
    lang: { state: true },
    torn: { state: true },
  };

  constructor() {
    super();
    this.lang = getLang();
    this.torn = false;

    this.stageRef = createRef();
    this.personRef = createRef();
    this.canvasRef = createRef();
    this.posterRef = createRef();
    this.stripRef = createRef();
    this.barRef = createRef();
    this.tornLayerRef = createRef();
    this.tabRef = createRef();
    this.flashRef = createRef();
    this.cornerRef = createRef();
    this.cornerInvRef = createRef();

    this.sound = new TearSound();
    this._draggable = null;
    this._cancelAtoms = null;
    this._cancelDrops = [];
    this._lastX = 0;
    this._dragSpeed = 0;
    // Рваный край фиксируется на всё время сессии: один надрыв, а не новый
    // случайный контур на каждом кадре.
    this._tearProfile = createTearProfile();
    // Горизонтальная линия отрыва: по ней останется рваный край на бумаге.
    this._bandProfile = createBandProfile();
  }

  connectedCallback() {
    super.connectedCallback();
    this._offLang = onLanguageChange(() => {
      this.lang = getLang();
    });
    this._onResize = () => {
      this._cachedTravel = null;
      this._draggable?.[0]?.applyBounds(this._bounds());
      // Кадр переехал — маску инверсии надо совместить заново.
      this._applyInvertMask();
    };
    window.addEventListener('resize', this._onResize);
  }

  disconnectedCallback() {
    this._offLang?.();
    window.removeEventListener('resize', this._onResize);
    this._draggable?.[0]?.kill();
    // Распад к этому моменту живёт своей жизнью на канвасе в body: экран уходит
    // из DOM намеренно, посреди анимации, и обрывать её здесь нельзя.
    if (!this._atomsDetached) this._cancelAtoms?.();
    this._cancelDrops.forEach((cancel) => cancel());
    this.sound.stop();
    super.disconnectedCallback();
  }

  firstUpdated() {
    // При прямом входе (?screen=…) экран сносят до того, как он отрисовался:
    // ссылок на узлы уже нет, и инициализировать нечего.
    if (!this.barRef.value) return;

    // Vite инлайнит SVG в data-URI, внутри которого есть литеральные «;».
    // В атрибуте style такой урл обрывает декларацию, поэтому фон ставим
    // свойством и в кавычках.
    this.barRef.value.style.backgroundImage = `url("${stripUrl}")`;

    this._initDrag();
    this._initInvertMask();
    this._pendulum = new SheetPendulum(this.posterRef.value);
  }

  updated() {
    // Смена языка меняет ширину строк — маску надо перепривязать.
    this._applyInvertMask();
  }

  /**
   * Максимальный ход язычка = ширина белой полосы хлястика.
   *
   * Значение кешируется: его спрашивают на каждое событие указателя, а
   * getBoundingClientRect заставляет браузер пересчитать вёрстку — на телефоне
   * это и давало рывки. Сбрасывается на ресайзе.
   */
  _maxTravel() {
    if (this._cachedTravel != null) return this._cachedTravel;

    const strip = this.stripRef.value;
    if (!strip) return 0;
    // 285.5 из 325 — доля белой полосы во всём хлястике по макету.
    this._cachedTravel = strip.getBoundingClientRect().width * (285.5 / 325);
    return this._cachedTravel;
  }

  _bounds() {
    return { minX: -this._maxTravel(), maxX: 0, minY: 0, maxY: 0 };
  }

  _initDrag() {
    const tab = this.tabRef.value;
    if (!tab) return;

    // Стрелки, чтобы не терять this компонента; позицию берём с самого инстанса.
    let instance;
    this._draggable = Draggable.create(tab, {
      type: 'x',
      bounds: this._bounds(),
      allowNativeTouchScrolling: false,
      // Синхронно и без ожиданий: звук на iOS заводится только в том же такте,
      // что и касание.
      onPress: () => {
        this._lastX = instance.x;
        this.sound.unlock();
        this.sound.start();
      },
      onDrag: () => this._onDrag(instance.x),
      onRelease: () => this._onRelease(),
    });
    instance = this._draggable[0];
  }

  _progress(x) {
    const max = this._maxTravel();
    return max > 0 ? Math.min(1, Math.abs(x) / max) : 0;
  }

  _onDrag(x) {
    const progress = this._progress(x);
    const delta = x - this._lastX;
    const speed = Math.abs(delta);
    this._lastX = x;
    this._dragSpeed = delta;

    // На телефоне событий указателя приходит больше, чем кадров, а каждая
    // перерисовка пересчитывает два многоугольника по три десятка точек.
    // Копим прогресс и рисуем один раз за кадр — отсюда пропадает рывками.
    this._pendingProgress = progress;
    if (!this._paintScheduled) {
      this._paintScheduled = true;
      requestAnimationFrame(() => {
        this._paintScheduled = false;
        this._paint(this._pendingProgress);
      });
    }

    this.sound.update(speed, progress);
    // Рывок за хлястик передаётся листу — тот качается на остатке кромки.
    this._pendulum?.impulse(delta * 0.9);

    // Лента отрывается только доведённая до конца полосы.
    if (progress >= TEAR_COMPLETE) this._finishTear();
  }

  /**
   * Отрисовка разрыва. Ничего не улетает и не падает: лист остаётся в руках,
   * просто вдоль линии отрыва расходится рваная кромка.
   */
  _paint(progress) {
    // После отрыва рисовать нечего: полосы уже нет в DOM.
    if (this.torn) return;

    const bar = this.barRef.value;
    const torn = this.tornLayerRef.value;
    if (!bar) return;

    // Линия разрыва идёт справа налево по зафиксированному рваному профилю.
    const cut = (1 - progress) * 100;
    gsap.set(bar, { clipPath: remainingClip(this._tearProfile, cut) });

    // Под полосой открывается надорванный слой — лента идёт по тому же краю.
    if (torn) {
      gsap.set(torn, {
        clipPath: edgeClip(this._tearProfile, cut),
        opacity: progress > 0.001 && progress < 0.999 ? 1 : 0,
      });
    }
    // На самой бумаге остаётся рваный край там, где ленту уже сорвали.
    gsap.set(this.posterRef.value, {
      clipPath: tornSheetClip(this._bandProfile, cut, BAND_Y, POSTER_H),
    });

    // Лист теряет опору: держится только неоторванным участком кромки, поэтому
    // повисает на нём и кренится тем сильнее, чем меньше осталось держаться.
    if (this._pendulum) {
      this._pendulum.setOrigin(`${cut / 2}% ${BAND_Y}%`);
      this._pendulum.setTarget(6 * progress * progress);
    }
  }

  _onRelease() {
    // Отпустили на полпути — надрыв никуда не девается: бумага порвана ровно
    // настолько, насколько потянули, и ждёт, когда возьмутся снова.
    this.sound.stop();
  }

  /** Клавиатурный путь: Enter/Space рвут хлястик без мыши. */
  _tearByKey() {
    if (this.torn) return;
    this.sound.unlock();
    this.sound.start();

    const tab = this.tabRef.value;
    gsap.to(tab, {
      x: -this._maxTravel(),
      duration: 0.9,
      ease: 'power2.in',
      onUpdate: () => {
        const p = this._progress(gsap.getProperty(tab, 'x'));
        this._paint(p);
        this.sound.update(14, p);
      },
      onComplete: () => this._finishTear(),
    });
  }

  _finishTear() {
    if (this.torn) return;
    this.torn = true;

    this._draggable?.[0]?.disable();
    this.sound.update(24, 1);
    this.sound.snap();
    this.sound.stop();

    // Скорость руки в момент отрыва становится начальной скоростью бумаги.
    const throwVx = gsap.utils.clamp(-900, 200, this._dragSpeed * 45);

    // Полоса «открыть» и надорванный слой своё отработали — выносим их из DOM.
    // Прозрачности мало: отрыв засчитывается чуть раньше единицы, по
    // остаточному прогрессу они оставались видимыми и улетали вниз лишней
    // белой лентой. Удаление снимает вопрос в любом состоянии.
    this.barRef.value?.remove();
    this.tornLayerRef.value?.remove();

    // Верх листа полупрозрачный: так он сливается с бумагой на фотографии, пока
    // его держат в руках. В полёте это выходит боком — лист проходит над
    // чёрными джинсами, тёмное просвечивает сквозь него, и рядом с бумагой
    // летит косой тёмный клин, неотличимый от тени. Оторванный лист прятать
    // больше не от чего, поэтому делаем его сплошным.
    if (this.posterRef.value) {
      this.posterRef.value.style.backgroundImage =
        'linear-gradient(180.4deg, rgb(234,234,237) 0%, rgb(255,255,255) 99.7%)';
    }

    // Маятник передаёт эстафету падению: лист срывается с того наклона,
    // на котором висел, а не подпрыгивает в ноль.
    const tilt = this._pendulum?.angle ?? 0;
    this._pendulum?.stop();

    // Теперь, когда лента оторвана целиком, из рук выпускают всё.
    // Лист — тяжелее и падает ровнее.
    this._cancelDrops.push(
      dropPaper(this.posterRef.value, {
        vx: throwVx * 0.3,
        vy: -30,
        spin: 90,
        drag: 0.00009,
        flutter: 1,
        startRotation: tilt,
        onDone: () => this._onSheetLanded(),
      }),
    );

    // Следом улетает ярлычок — он лёгкий, поэтому парусит сильнее и крутится
    // быстрее листа.
    gsap.delayedCall(0.12, () => {
      this._cancelDrops.push(
        dropPaper(this.stripRef.value, {
          vx: throwVx * 0.8,
          vy: -110,
          spin: -190,
          drag: 0.00019,
          flutter: 1.7,
        }),
      );
    });
  }

  /** Лист долетел до низа — теперь распадаемся. */
  _onSheetLanded() {
    this._runAtomize();
  }

  async _runAtomize() {
    const person = this.personRef.value;
    const canvas = this.canvasRef.value;
    if (!person || !canvas) {
      this._goToSite();
      return;
    }

    canvas.classList.remove('hidden');
    person.style.visibility = 'hidden';

    // Канвас переезжает в body поверх всего. Раздел лежит в DOM после первого
    // экрана, поэтому, проявляясь, он закрывал собой частицы: вместо сборки
    // было видно, как поверх зернистого облака наплывает готовый кадр. Сверху
    // рой садится на уже проступивший экран и гаснет последним.
    canvas.className = 'atomize-canvas';
    document.body.append(canvas);
    this._atomsDetached = true;

    // Раздел создаём сразу, но невидимым: он нужен, чтобы измерить, где встанут
    // его блоки. По этим местам и соберутся частицы.
    this._goToSite();

    const screen = document.querySelector('#site')?.firstElementChild;
    // Lit рендерит асинхронно: сразу после создания у экрана ещё нет ни одного
    // блока, и мишени вышли бы пустыми. Ждём первую отрисовку.
    await screen?.updateComplete;
    const targets = collectTargets(screen);

    // ?slow=8 растягивает распад: так его можно рассмотреть покадрово.
    const slow = Number(new URLSearchParams(location.search).get('slow')) || 1;

    this._cancelAtoms = atomize(canvas, person, {
      duration: 2600 * slow,
      targets,
      // Пока частицы садятся по местам, под ними проявляется настоящий экран.
      // К концу сборки он уже на месте, и частицы гаснут поверх готового кадра —
      // подмены не видно, фигура буквально пересобирается в сайт.
      // Экран проявляется только после того, как рой встал по местам: сначала
      // из частиц складывается силуэт раскладки, и уже он превращается в
      // вёрстку. Начни проявление раньше — и всё читалось бы наоборот:
      // интерфейс приехал сам, а частицы к нему подлетели.
      onAssemble: (progress) => {
        if (!screen) return;
        screen.style.opacity = String(Math.min(1, Math.max(0, (progress - 0.72) / 0.24)));
      },
      onDone: () => {
        if (screen) screen.style.opacity = '1';
        canvas.remove();
      },
    });

    // Первый экран больше не нужен: фигура целиком перешла в частицы, а лист с
    // хлястиком улетели за нижний край. Уходит он сейчас, а не в конце сборки,
    // иначе его фон так и стоял бы стеной между роем и проступающим разделом.
    //
    // Не мгновенно: вместе с ним пропадают имя и языки в углу, и резкое
    // исчезновение читалось как склейка двух разных кадров. За полсекунды
    // подписи растворяются вместе с фигурой — уходит весь экран целиком.
    gsap.to(this, {
      opacity: 0,
      duration: 0.5,
      ease: 'power2.in',
      onComplete: () => this.remove(),
    });
  }

  /**
   * Маска инверсии подписей.
   *
   * Из фотографии один раз печётся чёрно-белая маска: непрозрачная там, где
   * фон тёмный. Ею обрезается верхний, белый слой подписей — и буква, заезжая
   * на футболку, белеет ровно по границе, попиксельно. В отличие от
   * mix-blend-mode здесь нет цветной каймы на коже: маска решает только
   * «тёмное/светлое», а не смешивает цвета.
   */
  _initInvertMask() {
    const img = this.personRef.value;
    if (!img) return;

    if (!img.complete || !img.naturalWidth) {
      img.addEventListener('load', () => this._initInvertMask(), { once: true });
      return;
    }

    const w = 520;
    const h = Math.max(1, Math.round((w * img.naturalHeight) / img.naturalWidth));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, w, h);

    const image = ctx.getImageData(0, 0, w, h);
    const data = image.data;
    const CANVAS_LUM = 0.906; // холст #e7e7e7 за пределами фигуры

    for (let i = 0; i < data.length; i += 4) {
      const alpha = data[i + 3] / 255;
      const lum =
        (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
      // Прозрачные места фотографии — это тот же светлый холст.
      const effective = lum * alpha + CANVAS_LUM * (1 - alpha);

      data[i] = 255;
      data[i + 1] = 255;
      data[i + 2] = 255;
      data[i + 3] = effective < 0.5 ? 255 : 0;
    }

    ctx.putImageData(image, 0, 0);
    this._maskUrl = canvas.toDataURL('image/png');
    this._applyInvertMask();
  }

  /** Маску нужно совместить с фотографией — она живёт в координатах вьюпорта. */
  _applyInvertMask() {
    const el = this.cornerInvRef.value;
    const img = this.personRef.value;
    if (!el || !img || !this._maskUrl) return;

    const box = img.getBoundingClientRect();
    const own = el.getBoundingClientRect();
    const value = `url("${this._maskUrl}")`;
    const position = `${box.left - own.left}px ${box.top - own.top}px`;
    const size = `${box.width}px ${box.height}px`;

    for (const prefix of ['webkitMask', 'mask']) {
      el.style[`${prefix}Image`] = value;
      el.style[`${prefix}Repeat`] = 'no-repeat';
      el.style[`${prefix}Position`] = position;
      el.style[`${prefix}Size`] = size;
    }
  }

  _goToSite() {
    // Дальше основной сайт. Пока — просто белая страница.
    this.dispatchEvent(
      new CustomEvent('enter-site', { bubbles: true, composed: true }),
    );
  }

  /**
   * Строки углового блока. Рисуются дважды — чёрным и белым; у белого слоя
   * кнопки выключены, чтобы клик всегда доставался нижнему.
   */
  _cornerLines(langCode, isOverlay) {
    return html`
      <div class="relative h-[6.6em] w-[13em] max-sm:w-auto">
        <div class="absolute left-0 top-0 whitespace-nowrap">${t('name')}</div>
        <div class="absolute left-[3.53em] top-[0.9em] whitespace-nowrap max-sm:left-[1.2em]">
          ${t('role')}
        </div>
        <div class="absolute left-[0.47em] top-[5.27em] flex items-center gap-[1.07em] max-sm:gap-[0.6em]">
          ${LOCALES.map(
            (locale) => html`
              <button
                type="button"
                lang=${locale.htmlLang}
                tabindex=${isOverlay ? -1 : 0}
                @click=${isOverlay ? null : () => setLang(locale.code)}
                aria-current=${langCode === locale.code ? 'true' : 'false'}
                class="bg-transparent p-0 font-serif leading-none tracking-[-0.07em] whitespace-nowrap ${isOverlay
                  ? 'pointer-events-none'
                  : 'cursor-pointer transition-opacity hover:opacity-60'} ${langCode ===
                locale.code
                  ? 'italic'
                  : ''}"
                style="font-size: inherit; color: inherit;"
              >
                [${locale.label}]
              </button>
            `,
          )}
        </div>
      </div>
    `;
  }

  render() {
    const langCode = this.lang;

    return html`
      <div class="fixed inset-0 z-20 overflow-hidden bg-canvas">
        <!-- Кадр с фотографией: всё внутри позиционируется в % от него -->
        <div
          ${ref(this.stageRef)}
          class="absolute bottom-0 left-1/2 -translate-x-1/2"
          style="height: var(--stage-h); width: var(--stage-w);"
        >
          <img
            ${ref(this.personRef)}
            src=${personUrl}
            alt=""
            crossorigin="anonymous"
            class="pointer-events-none absolute left-0 top-[-34.07%] h-[134.07%] w-full max-w-none object-cover select-none"
            draggable="false"
          />
          <!-- Постер -->
          <div
            ${ref(this.posterRef)}
            class="absolute origin-top"
            style="left:${POSTER.left}%; top:${POSTER.top}%; width:${POSTER.width}%; height:${POSTER.height}%;
                   background-image: linear-gradient(180.4deg, rgba(234,234,237,0) 5.9%, rgb(234,234,237) 11.9%, rgb(255,255,255) 99.7%);"
          >
            <div
              class="rough absolute left-1/2 -translate-x-1/2 text-center leading-none tracking-[-0.07em] whitespace-nowrap"
              style="top:42.9%; font-size: calc(var(--tx) * 30);"
            >
              <div id="poster-title">${t('posterFirst')}</div>
              <div class="-mt-[0.42em]">${t('posterLast')}</div>
              <div class="-mt-[0.42em] italic">${t('posterCase')}</div>
            </div>
          </div>

          <!-- Отдельной «оторванной ленты» здесь нет и не нужно: на самой
               фотографии человек уже держит оторванную полосу с рваным краем,
               и её линия разрыва совпадает с нашей. Постер просто перестаёт
               закрывать этот кусок — из-под него проступает настоящая бумага. -->

          <!-- Отрывной хлястик -->
          <div
            ${ref(this.stripRef)}
            class="absolute"
            style="left:${STRIP.left}%; top:${STRIP.top}%; width:${STRIP.width}%; aspect-ratio: 325 / 20;"
          >
            <!-- Надорванный слой: лежит под полосой, по его краю и идёт маска.
                 Тени вдоль разрыва дают ощущение толщины бумаги. -->
            <div
              ${ref(this.tornLayerRef)}
              class="pointer-events-none absolute left-0 top-0 h-full w-[87.8%] opacity-0"
              style="background-image: linear-gradient(
                       to right,
                       rgba(0, 0, 0, 0.1) 0%,
                       rgba(0, 0, 0, 0.03) 22%,
                       rgba(255, 255, 255, 0.75) 55%,
                       rgba(196, 193, 188, 0.5) 100%
                     );"
            ></div>

            <!-- Белая полоса с повторяющимся «открыть» (рамка — экспорт из Figma) -->
            <div
              ${ref(this.barRef)}
              class="absolute left-0 top-0 h-full w-[87.8%] overflow-hidden bg-no-repeat"
              style="background-size: 100% 100%;"
            >
              <div
                class="rough absolute left-[-2.5%] top-1/2 flex -translate-y-1/2 whitespace-nowrap tracking-[-0.04em]"
                style="font-size: calc(var(--tx) * 10); gap: calc(var(--tx) * 6);"
              >
                ${Array.from(
                  { length: TAB_REPEATS },
                  () => html`<span>${t('tear')}</span>`,
                )}
              </div>
            </div>

            <!-- Язычок: его тянут -->
            <div
              ${ref(this.tabRef)}
              data-drag-handle
              role="button"
              tabindex="0"
              aria-label=${t('hint')}
              @keydown=${(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  this._tearByKey();
                }
              }}
              class="absolute top-0 left-[87.8%] h-full w-[12.2%] select-none"
            >
              <!-- Форма язычка: свг больше своей рамки на величину тени (56.3×36.8 при боксе 39.5×20) -->
              <img
                src=${stripTabUrl}
                alt=""
                draggable="false"
                class="pointer-events-none absolute left-[-41.52%] top-[-42%] h-[184%] w-[142.53%] max-w-none"
              />
              <span
                class="absolute inset-0 flex items-center justify-center font-bold leading-none tracking-[-0.07em]"
                style="font-size: calc(var(--tx) * 20);"
                aria-hidden="true"
                >←</span
              >
            </div>
          </div>
        </div>

        <!-- Канвас распада лежит вне кадра с фотографией не случайно: у кадра
             есть -translate-x-1/2, а трансформ предка превращает fixed в
             позиционирование относительно него — канвас так и оставался
             размером с кадр, и частицы, летящие к блокам нового экрана,
             обрезались по его границам. -->
        <canvas
          ${ref(this.canvasRef)}
          class="pointer-events-none absolute inset-0 hidden h-full w-full"
        ></canvas>

        <!-- Имя, специализация, языки.
             Два одинаковых слоя: чёрный снизу и белый сверху. Белый обрезан
             маской по тёмным местам фотографии, поэтому буква, заезжая на
             футболку, белеет ровно по границе — попиксельно, без блендинга
             и без цветной каймы на коже. -->
        <div
          ${ref(this.cornerRef)}
          class="rough absolute left-[max(1.05vw,14px)] top-[max(1.85vh,14px)] leading-none tracking-[-0.07em] text-black"
          style="font-size: clamp(15px, calc(var(--tx) * 30), 30px);"
        >
          ${this._cornerLines(langCode, false)}
        </div>
        <!-- Слой растянут на весь экран не случайно: маска обрезает контент по
             border-box элемента, а у блока по размеру текста ширина схлопывается
             в ноль, и подписи срезало бы целиком. -->
        <div
          ${ref(this.cornerInvRef)}
          aria-hidden="true"
          class="rough pointer-events-none absolute inset-0 text-white"
        >
          <div
            class="absolute left-[max(1.05vw,14px)] top-[max(1.85vh,14px)] leading-none tracking-[-0.07em]"
            style="font-size: clamp(15px, calc(var(--tx) * 30), 30px);"
          >
            ${this._cornerLines(langCode, true)}
          </div>
        </div>

        <!-- Белая вспышка перехода на основной сайт -->
        <div
          ${ref(this.flashRef)}
          class="pointer-events-none absolute inset-0 bg-white opacity-0"
        ></div>
      </div>
    `;
  }
}

customElements.define('hero-tear', HeroTear);
