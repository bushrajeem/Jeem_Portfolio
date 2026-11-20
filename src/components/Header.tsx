import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Menu, Moon, Sun, X } from "lucide-react";
import { navLinks, profile } from "../data/portfolio";
import { useTheme } from "../hooks/useTheme";
import { GitHubLogo, LinkedInLogo } from "./ui/Logos";
import { WaveText, ease } from "./ui/Motion";

const primaryNav = navLinks.filter((l) => ["Projects", "About", "Contact"].includes(l.label));
const secondaryNav = navLinks.filter((l) => !["Projects", "About", "Contact"].includes(l.label));

type SpinState = {
  from: number;
  target: number;
  started: number;
  speed: number;
  fastFor: number;
  coastFor: number;
};

export function Header() {
  const { theme, toggle } = useTheme();
  const [open, setOpen] = useState(false);
  const wordmarkRef = useRef<HTMLSpanElement>(null);

  // Physics-driven 360deg wordmark spin (matches aswinpanengal.me):
  // spins every 3s automatically, and immediately on hover or keyboard focus,
  // smoothly coasting to rest on pointerleave.
  useEffect(() => {
    const el = wordmarkRef.current;
    const anchor = el?.closest("a");
    if (!el || !anchor) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let spin: SpinState | null = null;
    let rafId = 0;
    let intervalId = 0;
    let hovering = false;

    const sample = (now: number) => {
      if (!spin) return { angle: 0, speed: 0, finished: true };
      const dt = Math.max(0, now - spin.started);
      if (dt < spin.fastFor) {
        return { angle: spin.from + spin.speed * dt, speed: spin.speed, finished: false };
      }
      const t = Math.min(1, (dt - spin.fastFor) / spin.coastFor);
      const coastDist = (spin.speed * spin.coastFor) / 2;
      return {
        angle: spin.from + spin.speed * spin.fastFor + coastDist * (2 * t - t * t),
        speed: spin.speed * (1 - t),
        finished: t === 1,
      };
    };

    const reset = () => {
      cancelAnimationFrame(rafId);
      rafId = 0;
      spin = null;
      el.style.removeProperty("transform");
      el.style.removeProperty("will-change");
      el.dataset.spinning = "false";
    };

    const step = (now: number) => {
      const s = sample(now);
      if (s.finished) {
        reset();
      } else {
        el.style.transform = `rotate(${s.angle}deg)`;
        rafId = requestAnimationFrame(step);
      }
    };

    const launch = (next: SpinState) => {
      cancelAnimationFrame(rafId);
      spin = next;
      el.style.willChange = "transform";
      el.dataset.spinning = "true";
      rafId = requestAnimationFrame(step);
    };

    const triggerSpin = () => {
      if (reducedMotion.matches || document.hidden) return;
      const now = performance.now();
      const { angle } = sample(now);
      let remaining = 360 - (((angle % 360) + 360) % 360);
      if (remaining < 180) remaining += 360;
      const speed = 1.05;
      const fastFor = 120;
      launch({
        from: angle,
        target: angle + remaining,
        started: now,
        speed,
        fastFor,
        coastFor: (2 * (remaining - speed * fastFor)) / speed,
      });
    };

    const coastToRest = () => {
      if (!spin) return;
      const now = performance.now();
      const s = sample(now);
      if (s.finished || s.speed <= 0) {
        reset();
      } else {
        launch({
          from: s.angle,
          target: spin.target,
          started: now,
          speed: s.speed,
          fastFor: 0,
          coastFor: (2 * (spin.target - s.angle)) / s.speed,
        });
      }
    };

    const scheduleIdle = () => {
      window.clearInterval(intervalId);
      if (reducedMotion.matches || document.hidden) {
        hovering = false;
        reset();
        return;
      }
      if (!hovering && document.activeElement !== anchor) {
        intervalId = window.setInterval(() => {
          if (!spin && !hovering) triggerSpin();
        }, 3000);
      }
    };

    const onEnter = (e: PointerEvent) => {
      if (e.pointerType === "touch" || hovering) return;
      hovering = true;
      window.clearInterval(intervalId);
      triggerSpin();
    };

    const onLeave = () => {
      hovering = false;
      coastToRest();
      scheduleIdle();
    };

    const onFocus = () => {
      window.clearInterval(intervalId);
      if (!hovering && anchor.matches(":focus-visible")) triggerSpin();
    };

    const onBlur = () => {
      if (!hovering) coastToRest();
      scheduleIdle();
    };

    anchor.addEventListener("pointerenter", onEnter);
    anchor.addEventListener("pointerleave", onLeave);
    anchor.addEventListener("focus", onFocus);
    anchor.addEventListener("blur", onBlur);
    reducedMotion.addEventListener("change", scheduleIdle);
    document.addEventListener("visibilitychange", scheduleIdle);
    scheduleIdle();

    return () => {
      window.clearInterval(intervalId);
      reset();
      anchor.removeEventListener("pointerenter", onEnter);
      anchor.removeEventListener("pointerleave", onLeave);
      anchor.removeEventListener("focus", onFocus);
      anchor.removeEventListener("blur", onBlur);
      reducedMotion.removeEventListener("change", scheduleIdle);
      document.removeEventListener("visibilitychange", scheduleIdle);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      <header className="site-header">
        <div className="header-inner">
          <a href="#about" className="wordmark" aria-label={`${profile.name}, home`}>
            <span className="wordmark-text" ref={wordmarkRef}>
              {profile.shortName}
            </span>
          </a>

          <div className="header-actions">
            <button
              type="button"
              className="icon-button theme-toggle"
              onClick={toggle}
              aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
              title={theme === "dark" ? "Light mode" : "Dark mode"}
            >
              {theme === "dark" ? <Sun size={17} strokeWidth={2} /> : <Moon size={17} strokeWidth={2} />}
            </button>

            <button
              type="button"
              className="icon-button nav-menu-trigger"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="site-nav-dialog"
              aria-label="Open navigation menu"
            >
              <Menu size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              className="nav-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
              onClick={() => setOpen(false)}
              aria-hidden="true"
            />

            <motion.div
              id="site-nav-dialog"
              role="dialog"
              aria-modal="true"
              aria-label="Site navigation"
              className="nav-dialog"
              initial={{ opacity: 0, scale: 0.96, y: -12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97, y: -8 }}
              transition={{ duration: 0.34, ease }}
            >
              <nav className="nav-panel">
                <div className="nav-panel-top">
                  <button
                    type="button"
                    className="nav-panel-close wave-target"
                    onClick={() => setOpen(false)}
                    aria-label="Close navigation menu"
                  >
                    <WaveText>close</WaveText>
                    <span className="nav-close-circle" aria-hidden="true">
                      <X size={22} strokeWidth={2} />
                    </span>
                  </button>
                </div>

                <div className="nav-panel-links">
                  <div className="nav-menu-primary">
                    {primaryNav.map((item, idx) => (
                      <motion.a
                        key={item.href}
                        href={item.href}
                        className="wave-target"
                        onClick={() => setOpen(false)}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, ease, delay: 0.06 + idx * 0.05 }}
                      >
                        <WaveText>{item.label}</WaveText>
                      </motion.a>
                    ))}
                  </div>

                  <div className="nav-menu-secondary">
                    {secondaryNav.map((item) => (
                      <a
                        key={item.href}
                        href={item.href}
                        className="wave-target"
                        onClick={() => setOpen(false)}
                      >
                        <WaveText>{item.label}</WaveText>
                      </a>
                    ))}
                    <a
                      href={profile.resume}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="wave-target"
                      onClick={() => setOpen(false)}
                    >
                      <WaveText>Resume PDF</WaveText>
                      <ArrowUpRight size={15} />
                    </a>
                  </div>
                </div>

                <div className="nav-panel-footer">
                  <a href={`mailto:${profile.email}`} className="nav-panel-email wave-target">
                    <WaveText>{profile.email}</WaveText>
                  </a>

                  <div className="nav-panel-socials">
                    <a
                      href={profile.github}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="GitHub profile"
                    >
                      <GitHubLogo className="h-5 w-5" />
                    </a>
                    <a
                      href={profile.linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="LinkedIn profile"
                    >
                      <LinkedInLogo className="h-5 w-5" />
                    </a>
                  </div>
                </div>
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
