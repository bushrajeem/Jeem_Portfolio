import { ArrowUp } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { usePortfolio } from "../context/PortfolioContext";

const SHEETS = [
  "/footer/crowd-01.webp",
  "/footer/crowd-02.webp",
  "/footer/crowd-03.webp",
] as const;

const COLS = 5;
const ROWS = 3;
const CELLS_PER_SHEET = COLS * ROWS;
const TOTAL_CAST = SHEETS.length * CELLS_PER_SHEET;

type Walker = {
  cell: number;
  layer: 0 | 1;
  h: number;
  w: number;
  baseline: number;
  speed: number;
  phase: number;
  direction: 1 | -1;
};

function hash(n: number) {
  const v = 43758.5453 * Math.sin(127.1 * n + 311.7);
  return v - Math.floor(v);
}

/**
 * Interactive dual-canvas Dhaka crowd scene (mirrors aswinpanengal.me):
 * 45 illustrated Dhaka pedestrians walk in two depth lanes behind and in front
 * of Jeem's standing portrait over the monumental "JEEM." wordmark.
 * Click anywhere on the stage to pause or resume.
 */
export function FooterCrowd() {
  const { profile } = usePortfolio();
  const stageRef = useRef<HTMLButtonElement>(null);
  const backCanvasRef = useRef<HTMLCanvasElement>(null);
  const frontCanvasRef = useRef<HTMLCanvasElement>(null);
  const portraitRef = useRef<HTMLImageElement>(null);
  const descId = useId();

  const [paused, setPaused] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [ready, setReady] = useState(false);
  const controlRef = useRef({ paused: false, reduced: false, sync: () => {} });

  useEffect(() => {
    controlRef.current.paused = paused;
    controlRef.current.reduced = reduced;
    controlRef.current.sync();
  }, [paused, reduced]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const canvases = [backCanvasRef.current, frontCanvasRef.current];
    const contexts = canvases.map((c) => c?.getContext("2d"));
    if (!stage || !canvases[0] || !canvases[1] || !contexts[0] || !contexts[1])
      return;

    const backCanvas = canvases[0];
    const frontCanvas = canvases[1];
    const ctxList = [contexts[0], contexts[1]] as const;
    const ctrl = controlRef.current;

    const images = SHEETS.map((src) => {
      const img = new Image();
      img.src = src;
      return img;
    });

    let disposed = false;
    let loaded = false;
    let inView = false;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let elapsed = 0;
    let lastTime = 0;
    let rafId = 0;
    let padX = 0;
    let spanX = 0;
    let walkers: Walker[] = [];

    const draw = () => {
      ctxList.forEach((ctx) => {
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);
      });

      walkers.forEach((w) => {
        const t = w.phase + (elapsed * w.speed) / 10;
        const cycle = Math.floor(t);
        const frac = t - cycle;
        const idx =
          (((w.cell + 17 * cycle) % TOTAL_CAST) + TOTAL_CAST) % TOTAL_CAST;
        const img = images[Math.floor(idx / CELLS_PER_SHEET)];
        if (!img.naturalWidth) return;

        const cellW = img.naturalWidth / COLS;
        const cellH = img.naturalHeight / ROWS;
        const local = idx % CELLS_PER_SHEET;
        const x = (w.direction === 1 ? frac : 1 - frac) * spanX - padX;
        const bob =
          (1 - Math.cos((elapsed * w.speed + 10 * w.phase) * Math.PI * 4)) * 5;
        const personScale = 0.92 + 0.14 * hash(idx + 13);
        const ctx = ctxList[w.layer];

        ctx.save();
        ctx.translate(x, w.baseline + w.h * (1 - personScale) - bob);
        ctx.scale(w.direction, 1);
        ctx.drawImage(
          img,
          (local % COLS) * cellW,
          Math.floor(local / COLS) * cellH,
          cellW,
          cellH,
          (-w.w * personScale) / 2,
          0,
          w.w * personScale,
          w.h * personScale,
        );
        ctx.restore();
      });
    };

    const tick = (now: number) => {
      if (lastTime) elapsed += Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      draw();
      rafId = requestAnimationFrame(tick);
    };

    const sync = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
      lastTime = 0;
      if (loaded && !disposed) {
        draw();
        if (inView && !document.hidden && !ctrl.paused && !ctrl.reduced) {
          rafId = requestAnimationFrame(tick);
        }
      }
    };
    ctrl.sync = sync;

    const layout = () => {
      if (!loaded || disposed) return;
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (width === w && height === h) return;

      width = w;
      height = h;
      dpr = Math.min(window.devicePixelRatio || 1, 2);

      const portraitH =
        portraitRef.current?.getBoundingClientRect().height ||
        Math.min(295, height * 0.76);
      const stageAnchor = Math.max(portraitH, Math.min(365, height - 24));

      [backCanvas, frontCanvas].forEach((c) => {
        c.width = Math.round(width * dpr);
        c.height = Math.round(height * dpr);
      });

      const isDesktop = width >= 600;
      const scale = Math.min(1, stageAnchor / 310);
      const density = width / (1440 * Math.max(0.4, scale));
      const counts = isDesktop
        ? ([25, 16] as const)
        : ([
            Math.max(9, Math.round(25 * density)),
            Math.max(6, Math.round(16 * density)),
          ] as const);
      const total = counts[0] + counts[1];

      walkers = Array.from({ length: total }, (_, i) => {
        const lane = i < counts[0] ? 0 : 1;
        const laneIdx = lane === 0 ? i : i - counts[0];
        const laneCount = counts[lane];
        const charH =
          (lane === 1 ? 250 + 30 * hash(i + 8) : 170 + 35 * hash(i + 8)) *
          scale;
        const baseline =
          lane === 0
            ? height - stageAnchor - 12 + 38 * hash(i + 4)
            : height - charH + 30 * scale + 18 * hash(i + 4);
        const cell = (17 * Math.floor((TOTAL_CAST * i) / total)) % TOTAL_CAST;
        const speed = (lane === 1 ? 1.05 : 0.7) * (0.88 + 0.24 * hash(i + 97));
        return {
          cell,
          layer: (lane > 0 || laneIdx % 3 === 0 ? 1 : 0) as 0 | 1,
          h: charH,
          w: 0.8 * charH,
          baseline,
          speed,
          phase: (laneIdx + 0.85 * hash(i + 41)) / laneCount,
          direction: (lane === 1 ? -1 : 1) as 1 | -1,
        };
      }).sort((a, b) => a.baseline - b.baseline);

      padX = Math.max(...walkers.map((x) => x.w));
      spanX = width + 2 * padX;
      sync();
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        inView = entry.isIntersecting;
        sync();
      },
      { rootMargin: "80px" },
    );
    io.observe(stage);

    const ro = new ResizeObserver(layout);
    ro.observe(stage);
    document.addEventListener("visibilitychange", sync);

    Promise.all(images.map((img) => img.decode().catch(() => undefined))).then(
      () => {
        if (disposed) return;
        loaded = true;
        layout();
        setReady(true);
      },
    );

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      io.disconnect();
      ro.disconnect();
      ctrl.sync = () => {};
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  const handleBackToTop = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: reduced ? "instant" : "smooth" });
  };

  const displayName = `${profile.shortName.toUpperCase()}.`;

  return (
    <div className="footer-finale">
      <div className="footer-finale-heading wrap">
        <p>See you around.</p>
        <a href="#top" onClick={handleBackToTop} aria-label="Back to top">
          <span>Back to top</span>
          <ArrowUp size={16} aria-hidden="true" />
        </a>
      </div>

      <p id={descId} className="sr-only">
        45 original black-and-white illustrated Dhaka pedestrians walking past
        in two layers: university students with headphones and iced coffee,
        people in sarees, kurtis and panjabis, commuters with umbrellas, laptops
        and tea cups. {profile.shortName} stands still in the center with hands
        in her blazer pockets, wearing a crisp tailored blazer, black inner top,
        wide pleated trousers, and black loafers while the crowd passes behind
        and in front of her. Click to pause or resume the animation.
      </p>

      <button
        ref={stageRef}
        type="button"
        className="footer-crowd-scene"
        disabled={reduced}
        onClick={() => setPaused((p) => !p)}
        aria-label={
          paused
            ? `${displayName} Resume crowd animation`
            : `${displayName} Pause crowd animation`
        }
        aria-describedby={descId}
        aria-pressed={paused || reduced}
        data-cast-size={TOTAL_CAST}
        data-ready={ready}
      >
        <span className="footer-crowd-name" aria-hidden="true">
          {displayName}
        </span>
        <canvas
          ref={backCanvasRef}
          className="footer-crowd-layer footer-crowd-back"
          aria-hidden="true"
        />
        <img
          ref={portraitRef}
          className="footer-crowd-portrait"
          src={profile.footerPortrait || "/footer/animated_jeem.webp"}
          alt=""
          loading="lazy"
        />
        <canvas
          ref={frontCanvasRef}
          className="footer-crowd-layer footer-crowd-front"
          aria-hidden="true"
        />
      </button>

      <div className="footer-scene-bottom wrap">
        <small>Finally, some traffic on my website.</small>
      </div>
    </div>
  );
}
