import { useEffect, useRef } from "react";
import { Portrait } from "./Portrait";

/**
 * Scroll-driven 3D portrait journey (mirrors aswinpanengal.me):
 * glides the centered monochrome hero portrait down into the Biography middle
 * column while smoothly scaling, morphing border-radius, and flipping 180deg Y
 * to reveal the full-color portrait.
 */
export function PortraitJourney() {
  const journeyRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const journey = journeyRef.current;
    const card = cardRef.current;
    const section = journey?.closest<HTMLElement>(".about-section");
    const heroSlot = section?.querySelector<HTMLElement>(".hero-portrait-link");
    const bioSlot = section?.querySelector<HTMLElement>(".bio-portrait");
    const stage = journey?.querySelector<HTMLElement>(".portrait-sticky-stage");

    if (!journey || !card || !section || !heroSlot || !bioSlot || !stage) return;

    const motionOk = window.matchMedia("(prefers-reduced-motion: no-preference)");
    const coarseMobile = window.matchMedia("(max-width: 700px) and (pointer: coarse)");

    let rafId = 0;
    let progress = 0;
    let target = 0;
    let startScroll = 0;
    let scrollSpan = 1;
    let scaleX = 0.5;
    let scaleY = 0.5;
    let deltaY = 0;
    let deltaX = 0;
    let heroRadius = 9;
    let bioRadius = 16;
    let lastTime = 0;
    let disposed = false;

    const applyTransform = () => {
      const sx = scaleX + (1 - scaleX) * progress;
      const sy = scaleY + (1 - scaleY) * progress;
      const eased = progress * progress * (3 - 2 * progress);

      card.style.transform = `perspective(1200px) translate(${deltaX * (1 - progress)}px, ${deltaY * (1 - progress)}px) scale(${sx}, ${sy}) rotateY(${180 * eased}deg)`;
      card.style.borderRadius = `${heroRadius + (bioRadius - heroRadius) * progress}px`;
      card.style.willChange = progress > 0 && progress < 1 ? "transform" : "auto";
      section.classList.toggle("portrait-motion-active", target > 0 || progress > 0);
    };

    const animate = (now: number) => {
      const dt = lastTime ? Math.min(now - lastTime, 64) : 16.67;
      lastTime = now;
      progress += (target - progress) * (1 - Math.exp(-dt / (coarseMobile.matches ? 100 : 65)));
      const settled = Math.abs(target - progress) < 1e-4;
      if (settled) progress = target;
      applyTransform();
      if (settled) {
        rafId = 0;
        lastTime = 0;
      } else {
        rafId = requestAnimationFrame(animate);
      }
    };

    const onScroll = () => {
      if (!motionOk.matches) return;
      target = Math.max(0, Math.min(1, (window.scrollY - startScroll) / scrollSpan));
      section.classList.toggle("portrait-motion-active", target > 0 || progress > 0);
      if (!rafId && target !== progress) {
        rafId = requestAnimationFrame(animate);
      }
    };

    const measure = () => {
      if (disposed) return;
      cancelAnimationFrame(rafId);
      rafId = 0;
      lastTime = 0;

      if (!motionOk.matches) {
        section.classList.remove("portrait-motion-ready", "portrait-motion-active");
        return;
      }

      section.classList.add("portrait-motion-ready");
      const secRect = section.getBoundingClientRect();
      const heroRect = heroSlot.getBoundingClientRect();
      const bioRect = bioSlot.getBoundingClientRect();
      const viewportH = coarseMobile.matches
        ? stage.getBoundingClientRect().height
        : document.documentElement.clientHeight;
      const stickyTop = viewportH - 20 - bioRect.height;

      startScroll = secRect.top + window.scrollY;
      scrollSpan = bioRect.top + window.scrollY - startScroll - stickyTop;

      if (scrollSpan <= 0 || !bioRect.width) {
        section.classList.remove("portrait-motion-ready", "portrait-motion-active");
        return;
      }

      scaleX = heroRect.width / bioRect.width;
      scaleY = heroRect.height / bioRect.height;
      deltaY = heroRect.top + window.scrollY - startScroll - stickyTop - (bioRect.height - heroRect.height) / 2;
      deltaX = heroRect.left + heroRect.width / 2 - (bioRect.left + bioRect.width / 2);
      heroRadius = parseFloat(getComputedStyle(heroSlot).borderTopLeftRadius) / Math.min(scaleX, scaleY);
      bioRadius = parseFloat(getComputedStyle(bioSlot).borderTopLeftRadius);

      journey.style.height = `${scrollSpan + viewportH}px`;
      card.style.width = `${bioRect.width}px`;
      card.style.height = `${bioRect.height}px`;
      card.style.left = `${bioRect.left - secRect.left}px`;
      card.style.top = `${stickyTop}px`;

      progress = target = Math.max(0, Math.min(1, (window.scrollY - startScroll) / scrollSpan));
      section.classList.toggle("portrait-motion-active", target > 0);
      applyTransform();
      section.classList.add("portrait-motion-ready");
    };

    const ro = new ResizeObserver(measure);
    ro.observe(heroSlot);
    ro.observe(bioSlot);

    let lastW = window.innerWidth;
    const onResize = () => {
      if (coarseMobile.matches && window.innerWidth === lastW) return;
      lastW = window.innerWidth;
      measure();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("pageshow", measure);
    motionOk.addEventListener("change", measure);

    measure();
    document.fonts?.ready.then(measure);

    return () => {
      disposed = true;
      cancelAnimationFrame(rafId);
      ro.disconnect();
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("pageshow", measure);
      motionOk.removeEventListener("change", measure);
      section.classList.remove("portrait-motion-ready", "portrait-motion-active");
    };
  }, []);

  return (
    <div ref={journeyRef} className="portrait-journey" aria-hidden="true">
      <div className="portrait-sticky-stage">
        <div ref={cardRef} className="portrait-card">
          <div className="portrait-face portrait-face-front">
            <Portrait eager grayscale decorative />
          </div>
          <div className="portrait-face portrait-face-back">
            <Portrait eager decorative />
          </div>
        </div>
      </div>
    </div>
  );
}
