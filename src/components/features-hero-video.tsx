"use client";

import { useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import "./features-hero-video.css";

export function FeaturesHeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const hero = video?.closest<HTMLElement>(".mpp-hero");
    if (!video || !hero) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let targetTime = 0;
    const seek = () => {
      // Coalesce scroll updates while the browser decodes the previous seek.
      if (!video.seeking && Math.abs(video.currentTime - targetTime) > 1 / 120) {
        video.currentTime = targetTime;
      }
    };
    const update = () => {
      frame = 0;
      if (!Number.isFinite(video.duration) || video.duration <= 0) return;
      const visual = video.getBoundingClientRect();
      // Start when the visual enters view, including stacked mobile layouts.
      const start = Math.max(0, visual.top + window.scrollY - window.innerHeight * .75);
      const end = Math.max(start + 1, visual.bottom + window.scrollY - 120);
      const progress = Math.min(1, Math.max(0, (window.scrollY - start) / (end - start)));
      targetTime = reducedMotion.matches ? 0 : progress * Math.max(0, video.duration - 1 / 120);
      seek();
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(hero);
    video.addEventListener("loadeddata", schedule);
    video.addEventListener("loadedmetadata", schedule);
    video.addEventListener("seeked", seek);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    schedule();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      video.removeEventListener("loadeddata", schedule);
      video.removeEventListener("loadedmetadata", schedule);
      video.removeEventListener("seeked", seek);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
    };
  }, []);

  return (
    <figure className="features-hero-video">
      <video
        ref={videoRef}
        src="/animations/box-to-dieline-animation.mp4"
        width={1582}
        height={1674}
        muted
        playsInline
        preload="auto"
        aria-label="A 3D box unfolding into its flat dieline as you scroll"
        aria-describedby="features-video-caption"
      />
      <figcaption id="features-video-caption">
        <span>From box to dieline</span>
        <span className="features-video-scroll-hint"><ArrowDown aria-hidden="true" /> Scroll to unfold</span>
      </figcaption>
    </figure>
  );
}
