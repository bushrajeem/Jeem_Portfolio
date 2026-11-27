import { usePortfolio } from "../../context/PortfolioContext";

type PortraitProps = {
  className?: string;
  eager?: boolean;
  grayscale?: boolean;
  decorative?: boolean;
};

/**
 * Photo card: dark zinc surface, object-cover/object-top crop, a subtle
 * white/15 ring and a soft bottom gradient so the blazer melts into the card.
 */
export function Portrait({
  className = "",
  eager = false,
  grayscale = false,
  decorative = false,
}: PortraitProps) {
  const { profile } = usePortfolio();
  return (
    <div
      className={`portrait-frame relative m-0 h-full w-full overflow-hidden bg-zinc-950 ring-1 ring-white/15 ring-inset ${className}`}
    >
      <img
        src={profile.portrait}
        alt={decorative ? "" : `Portrait of ${profile.name}`}
        width={1000}
        height={1500}
        loading={eager ? "eager" : "lazy"}
        decoding="async"
        className={`block h-full w-full object-cover object-top ${grayscale ? "grayscale" : ""}`}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-linear-to-t from-zinc-950/60 via-transparent to-transparent"
      />
    </div>
  );
}
