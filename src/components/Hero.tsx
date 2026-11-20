import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { hero, heroCode, profile } from "../data/portfolio";
import { GlyphBackground } from "./ui/GlyphBackground";
import { Portrait } from "./ui/Portrait";

const POWER3_OUT = [0.215, 0.61, 0.355, 1] as const;

function HeroCodeMark({ side, visible }: { side: "open" | "close"; visible: boolean }) {
  const isOpen = side === "open";
  return (
    <span className={`hero-code-mark ${isOpen ? "hero-code-open" : "hero-code-close"}`} aria-hidden="true">
      <motion.svg
        viewBox={isOpen ? "20 0 110 160" : "0 0 180 160"}
        fill="none"
        stroke="currentColor"
        strokeWidth="16"
        strokeLinecap="square"
        strokeLinejoin="miter"
        focusable="false"
        initial={false}
        animate={
          visible
            ? { rotate: 0, scale: 1, opacity: 1 }
            : { rotate: isOpen ? -45 : 45, scale: 0.96, opacity: 0 }
        }
        transition={
          visible
            ? { duration: 0.95, ease: POWER3_OUT, delay: isOpen ? 0.06 : 0.14 }
            : { duration: 0 }
        }
        style={{ transformOrigin: "50% 50%" }}
      >
        {isOpen ? (
          <>
            <path className="hero-code-depth" opacity="0.16" d="M105 30 48 80 105 130" transform="translate(5 6)" />
            <path d="M105 30 48 80 105 130" />
          </>
        ) : (
          <>
            <path
              className="hero-code-depth"
              opacity="0.16"
              d="M65 30 25 130M100 30 157 80 100 130"
              transform="translate(5 6)"
            />
            <path d="M65 30 25 130M100 30 157 80 100 130" />
          </>
        )}
      </motion.svg>
    </span>
  );
}

export function Hero() {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const terminalRef = useRef<HTMLSpanElement>(null);
  const [titleVisible, setTitleVisible] = useState(false);

  // Re-trigger the 3D letter flip-in whenever the hero enters view (>=40% visible),
  // matching aswinpanengal.me's IntersectionObserver behavior.
  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      setTitleVisible(true);
      return;
    }

    const checkVisible = () => {
      const rect = el.getBoundingClientRect();
      const visiblePx = Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0);
      return visiblePx >= 0.4 * rect.height;
    };

    if (checkVisible()) {
      const id = requestAnimationFrame(() => setTitleVisible(true));
      return () => cancelAnimationFrame(id);
    }
    return undefined;
  }, []);

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const io = new IntersectionObserver(
      ([entry]) => {
        if (reducedMotion.matches) {
          setTitleVisible(true);
          return;
        }
        if (entry.isIntersecting) {
          if (entry.intersectionRatio >= 0.4) {
            setTitleVisible(true);
          }
        } else {
          setTitleVisible(false);
        }
      },
      { threshold: [0, 0.4] },
    );
    io.observe(el);

    return () => io.disconnect();
  }, []);

  // Blinking terminal caret pauses when offscreen or tab hidden (matches aswinpanengal.me)
  useEffect(() => {
    const el = terminalRef.current;
    if (!el) return;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let inView = false;

    const sync = () => {
      el.dataset.running = String(inView && !document.hidden && !reducedMotion.matches);
    };

    const io = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      sync();
    });
    io.observe(el);
    reducedMotion.addEventListener("change", sync);
    document.addEventListener("visibilitychange", sync);

    return () => {
      io.disconnect();
      reducedMotion.removeEventListener("change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);

  return (
    <div id="top" className="hero wrap">
      <GlyphBackground code={heroCode} className="hero-code-background" />

      <a href="#biography" className="hero-portrait-link" aria-label={`About ${profile.name}`}>
        <Portrait eager grayscale />
      </a>

      <div className="hero-heading-composition">
        <h1
          ref={headingRef}
          className="hero-title hero-display-title"
          aria-label={hero.titleLines.join(" ")}
        >
          {hero.titleLines.map((line, lineIdx) => {
            const dir = lineIdx === 0 ? 1 : -1;
            const chars = Array.from(line);
            return (
              <span key={line} className="title-line" aria-hidden="true">
                <span className="hero-word">
                  <HeroCodeMark side={lineIdx === 0 ? "open" : "close"} visible={titleVisible} />

                  {chars.map((char, charIdx) => {
                    const order = lineIdx === 0 ? charIdx : chars.length - 1 - charIdx;
                    return (
                      <span key={`${line}-${charIdx}`} className="hero-letter-window">
                        <motion.span
                          className="hero-letter"
                          initial={false}
                          animate={
                            titleVisible
                              ? { y: "0%", rotateX: 0, scaleY: 1, opacity: 1 }
                              : { y: `${105 * dir}%`, rotateX: -80 * dir, scaleY: 0.65, opacity: 0 }
                          }
                          transition={
                            titleVisible
                              ? {
                                  duration: 0.82,
                                  ease: POWER3_OUT,
                                  delay: 0.1 * lineIdx + order * 0.035,
                                }
                              : { duration: 0 }
                          }
                          style={{ transformOrigin: lineIdx === 0 ? "50% 100%" : "50% 0%" }}
                        >
                          {char}
                        </motion.span>
                      </span>
                    );
                  })}
                </span>
              </span>
            );
          })}
        </h1>
      </div>

      <div className="hero-footer">
        <span className="hero-year num">©{profile.year}</span>
        <span className="hero-focus num">
          <span className="terminal-text" ref={terminalRef}>
            <span aria-hidden="true">{"{{\u00A0"}</span>
            <span>{hero.focus}</span>
            <span className="terminal-caret" aria-hidden="true" />
            <span aria-hidden="true">{"\u00A0}}"}</span>
          </span>
        </span>
      </div>
    </div>
  );
}
