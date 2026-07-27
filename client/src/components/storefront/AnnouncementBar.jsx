import { Megaphone } from "lucide-react";

// Single-line scrolling announcement strip. Hidden when no text.
//
// The marquee works by rendering the same text twice inside an inline-flex
// row; the row animates from `translateX(0)` to `translateX(-50%)`, which is
// exactly the width of one copy — so when the loop restarts, the second copy
// has just slid into the position the first copy started at: seamless.
//
// Users with `prefers-reduced-motion` see a single static copy (animation
// disabled in styles.css). Tweak speed by changing pixelsPerSecond.

function AnnouncementBar({ text, pixelsPerSecond = 60 }) {
  if (!text || !text.trim()) return null;

  // Make the loop duration proportional to text length so short messages
  // don't whip past and long messages don't crawl.
  const approximatePixelWidth = Math.max(text.length * 8, 240);
  const durationSeconds = Math.max(approximatePixelWidth / pixelsPerSecond, 8);

  return (
    <div
      role="status"
      aria-live="polite"
      className="border-b border-emerald-700/40 bg-emerald-600 text-white"
    >
      <div className="flex items-center gap-3 px-4 py-2 sm:px-6 lg:px-8">
        <Megaphone
          aria-hidden="true"
          size={16}
          className="shrink-0 text-emerald-100"
        />
        <div className="relative w-full overflow-hidden">
          <div
            className="animate-marquee inline-flex w-max items-center gap-12 whitespace-nowrap text-sm font-semibold tracking-wide"
            style={{ animationDuration: `${durationSeconds}s` }}
          >
            {/* Two copies so the looped translateX(-50%) seamlessly aligns. */}
            <span>{text}</span>
            <span aria-hidden="true">{text}</span>
          </div>
          {/* Soft fades at the edges so text doesn't appear clipped. */}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-emerald-600 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-emerald-600 to-transparent" />
        </div>
      </div>
    </div>
  );
}

export default AnnouncementBar;
