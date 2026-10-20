"use client";

import { useEffect, useRef } from "react";

/**
 * A muted, looping clip that downloads and plays only once it nears the
 * screen, so it never competes with the page's first paint. Until then, and
 * for visitors who ask for reduced motion, it shows its poster.
 */
export function InViewVideo({ src, poster, label, className }: { src: string; poster: string; label: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        if (!video.src) video.src = src;
        video.play().catch(() => {});
      } else if (video.src) {
        video.pause();
      }
    }, { rootMargin: "200px 0px" });
    observer.observe(video);
    return () => observer.disconnect();
  }, [src]);
  return <video ref={ref} className={className} muted loop playsInline preload="none" poster={poster} aria-label={label} />;
}
