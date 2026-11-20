import type { ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

/** Rolling-letter hover text used across links (mirrors the reference "wave" effect). */
export function WaveText({ children }: { children: string }) {
  return (
    <span className="wave-text">
      <span className="sr-only">{children}</span>
      <span aria-hidden="true" className="wave-window">
        <span className="wave-glyph" data-char={children}>
          {children}
        </span>
      </span>
    </span>
  );
}

const ease = [0.22, 1, 0.36, 1] as const;

/** Fade-up reveal on first scroll into view. */
export function Reveal({
  children,
  delay = 0,
  y = 28,
  ...rest
}: { children: ReactNode; delay?: number; y?: number } & HTMLMotionProps<"div">) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "0px 0px -12% 0px" }}
      transition={{ duration: 0.8, ease, delay }}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export { ease };
