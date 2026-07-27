// Smooth hover-activated carousel for product cards.
//
// All images are stacked absolutely; the "active" one has opacity 1, the
// others fade to 0. On mouseenter, a setInterval bumps the active index every
// `intervalMs` so the images cross-fade. On mouseleave we reset to the cover
// image so the next hover starts fresh.
//
// `prefers-reduced-motion` users see only the cover (no auto-rotation, no
// fade) so the carousel doesn't get in the way.
import { useEffect, useMemo, useRef, useState } from "react";

const FADE_DURATION_MS = 450;

function HoverCarousel({
  images,
  alt = "",
  className = "",
  style,
  intervalMs = 1400
}) {
  const containerRef = useRef(null);
  const timerRef = useRef(null);
  const [active, setActive] = useState(0);
  const [isHovering, setIsHovering] = useState(false);

  // Dedupe — the cover image might already appear in the gallery list.
  const slides = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const url of images || []) {
      if (!url || seen.has(url)) continue;
      seen.add(url);
      list.push(url);
    }
    return list;
  }, [images]);

  // Honour prefers-reduced-motion. Hooked once; if the user toggles their
  // OS setting while the page is open we pick it up via the change event.
  const [reducedMotion, setReducedMotion] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = (event) => setReducedMotion(event.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  // Run / stop the rotation timer based on hover state.
  useEffect(() => {
    if (!isHovering || reducedMotion || slides.length <= 1) return undefined;
    timerRef.current = window.setInterval(() => {
      setActive((current) => (current + 1) % slides.length);
    }, intervalMs);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
    };
  }, [isHovering, reducedMotion, slides.length, intervalMs]);

  function handleMouseLeave() {
    setIsHovering(false);
    setActive(0);
  }

  if (slides.length === 0) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-xs font-semibold text-slate-400 ${className}`}
        style={style}
      >
        No image
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-slate-100 ${className}`}
      style={style}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={handleMouseLeave}
    >
      {slides.map((src, index) => (
        <img
          key={src}
          src={src}
          alt={index === 0 ? alt : ""}
          aria-hidden={index !== 0}
          loading={index === 0 ? "eager" : "lazy"}
          className="absolute inset-0 h-full w-full object-cover transition-opacity"
          style={{
            opacity: index === active ? 1 : 0,
            transitionDuration: `${FADE_DURATION_MS}ms`
          }}
        />
      ))}

      {slides.length > 1 ? (
        <div
          className="pointer-events-none absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1.5"
          aria-hidden="true"
        >
          {slides.map((src, index) => (
            <span
              key={src}
              className={`h-1.5 w-1.5 rounded-full transition-all duration-300 ${
                index === active
                  ? "w-4 bg-white"
                  : "bg-white/60"
              }`}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default HoverCarousel;
