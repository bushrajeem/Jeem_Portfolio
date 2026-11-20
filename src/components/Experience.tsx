import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { journey, milestones } from "../data/portfolio";
import { Reveal, ease } from "./ui/Motion";

export function Experience() {
  const roadmapRef = useRef<HTMLDivElement>(null);
  const markerRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [roadPath, setRoadPath] = useState("");

  useEffect(() => {
    const computePath = () => {
      const container = roadmapRef.current;
      if (!container) return;

      const box = container.getBoundingClientRect();
      const points = markerRefs.current
        .map((el) => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return {
            x: r.left - box.left + r.width / 2,
            y: r.top - box.top + r.height / 2,
          };
        })
        .filter((p): p is { x: number; y: number } => p !== null);

      if (points.length < 2) return;

      const segments = points.map((pt, i) => {
        if (i === 0) return `M ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
        const prev = points[i - 1];
        const midX = ((prev.x + pt.x) / 2).toFixed(1);
        return `C ${midX} ${prev.y.toFixed(1)}, ${midX} ${pt.y.toFixed(1)}, ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`;
      });

      setRoadPath(segments.join(" "));
    };

    computePath();
    const observer = new ResizeObserver(computePath);
    if (roadmapRef.current) observer.observe(roadmapRef.current);
    window.addEventListener("resize", computePath);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", computePath);
    };
  }, []);

  return (
    <section id="experience" className="experience-section" aria-labelledby="experience-heading">
      <div className="wrap">
        <Reveal className="split-heading">
          <h2 id="experience-heading">Experience.</h2>
          <p>
            Current standing.
            <br />
            Back to the foundations.
          </p>
        </Reveal>

        <div ref={roadmapRef} className="journey-roadmap">
          {roadPath && (
            <svg className="journey-road" aria-hidden="true">
              <path className="journey-road-base" d={roadPath} />
              <motion.path
                className="journey-road-ink"
                d={roadPath}
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true, margin: "0px 0px -15% 0px" }}
                transition={{ duration: 1.6, ease }}
              />
            </svg>
          )}

          {journey.map((stop, idx) => (
            <Reveal
              key={stop.id}
              delay={idx * 0.08}
              className={`journey-stop${stop.current ? " journey-now" : ""}`}
              data-offset={stop.offset}
            >
              <div
                ref={(el) => {
                  markerRefs.current[idx] = el;
                }}
                className="journey-stop-marker"
                aria-hidden="true"
              >
                <span />
              </div>

              <div className="journey-stop-content">
                <p className="journey-date num">
                  {stop.current && <span className="journey-current">Current</span>}
                  <span>{stop.date}</span>
                </p>
                <h3>{stop.title}</h3>
                <p className="journey-place">
                  {stop.place}
                  {stop.placeNote && <span className="num">{stop.placeNote}</span>}
                </p>
                <p className="journey-description">{stop.description}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <div className="milestones">
          {milestones.map((group, idx) => (
            <Reveal key={group.group} delay={idx * 0.08} className="milestone-group">
              <h3>{group.group}</h3>
              <ul>
                {group.items.map((item) => (
                  <li key={item.title}>
                    <strong>{item.title}</strong>
                    <span className="num">{item.detail}</span>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
