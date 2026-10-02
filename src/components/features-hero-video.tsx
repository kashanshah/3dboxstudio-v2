"use client";

import { useEffect, useRef } from "react";
import { ArrowDown } from "lucide-react";
import "./features-hero-video.css";

export function FeaturesHeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const figureRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    const figure = figureRef.current;
    const track = video?.closest<HTMLElement>(".mpp-hero-track");
    const hero = track?.querySelector<HTMLElement>(".mpp-hero");
    const aside = track?.querySelector<HTMLElement>(".mpp-hero-aside");
    if (!video || !figure || !track || !hero || !aside) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const header = document.querySelector<HTMLElement>(".marketing-header");
    const timeline = figure.querySelector<HTMLInputElement>("input[type=range]");
    const percentage = figure.querySelector<HTMLElement>(".features-video-percentage");
    const instruction = figure.querySelector<HTMLElement>(".features-video-instruction");
    let frame = 0;
    let targetTime = 0;
    let failed = false;
    // HAVE_CURRENT_DATA can drop while seeking. Loading is a one-way latch.
    let hasLoaded = video.readyState >= 2;

    const seek = () => {
      // Keep the latest requested time while the browser decodes a previous seek.
      if (!video.seeking && Math.abs(video.currentTime - targetTime) > 1 / 120) {
        video.currentTime = targetTime;
      }
    };
    const showProgress = (progress: number) => {
      figure.style.setProperty("--features-progress", `${progress * 100}%`);
      const percent = Math.round(progress * 100);
      if (timeline) timeline.value = String(percent);
      if (percentage) percentage.textContent = `${percent}%`;
      if (instruction) instruction.textContent = progress >= 1 ? "Scroll to continue" : "Scroll or drag to preview";
    };
    const update = () => {
      frame = 0;
      const ready = !failed && hasLoaded && Number.isFinite(video.duration) && video.duration > 0;
      const pinned = ready && !reducedMotion.matches;
      track.dataset.scrollReady = String(pinned);
      const headerHeight = header?.getBoundingClientRect().height ?? 83;
      track.style.setProperty("--features-header-height", `${headerHeight}px`);
      if (!ready) return;
      if (!pinned) {
        targetTime = 0;
        seek();
        return;
      }

      const rect = aside.getBoundingClientRect();
      const start = rect.top + window.scrollY - headerHeight - 16;
      const naturalRunway = rect.height - figure.getBoundingClientRect().height;
      // Stacked layouts have no extra column height; avoid a one-pixel scrub.
      const runway = naturalRunway > 1 ? naturalRunway : Math.max(1, window.innerHeight * .35);
      // Finish before sticky releases, leaving the final frame visible briefly.
      const hold = Math.min(runway * .1, window.innerHeight * .15);
      const progress = Math.min(1, Math.max(0, (window.scrollY - start) / Math.max(1, runway - hold)));
      targetTime = progress * Math.max(0, video.duration - 1 / 120);
      seek();
      showProgress(progress);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    const onError = () => { failed = true; schedule(); };
    const onLoaded = () => { hasLoaded = true; schedule(); };
    const onInput = () => {
      if (!timeline || !hasLoaded || failed || !Number.isFinite(video.duration)) return;
      const progress = Number(timeline.value) / 100;
      targetTime = progress * Math.max(0, video.duration - 1 / 120);
      showProgress(progress);
      seek();
    };
    const resizeObserver = new ResizeObserver(schedule);
    resizeObserver.observe(hero);
    if (header) resizeObserver.observe(header);
    video.addEventListener("loadeddata", onLoaded);
    timeline?.addEventListener("input", onInput);
    video.addEventListener("loadedmetadata", schedule);
    video.addEventListener("error", onError);
    video.addEventListener("seeked", seek);
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    reducedMotion.addEventListener("change", schedule);
    schedule();

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      video.removeEventListener("loadeddata", onLoaded);
      timeline?.removeEventListener("input", onInput);
      video.removeEventListener("loadedmetadata", schedule);
      video.removeEventListener("error", onError);
      video.removeEventListener("seeked", seek);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      reducedMotion.removeEventListener("change", schedule);
      delete track.dataset.scrollReady;
      track.style.removeProperty("--features-header-height");
    };
  }, []);

  const skipAnimation = () => {
    const nextSection = figureRef.current?.closest(".mpp-hero-track")?.nextElementSibling;
    if (!(nextSection instanceof HTMLElement)) return;
    nextSection.focus({ preventScroll: true });
    const headerHeight = document.querySelector(".marketing-header")?.getBoundingClientRect().height ?? 83;
    window.scrollTo({ top: nextSection.getBoundingClientRect().top + window.scrollY - headerHeight, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  };

  return (
    <figure ref={figureRef} className="features-hero-video">
      <video ref={videoRef} src="/animations/box-to-dieline-animation.mp4"
        width={1582} height={1674} muted playsInline preload="auto"
        aria-label="A 3D box unfolding into its flat dieline as you scroll"
        aria-describedby="features-video-caption" />
      <figcaption id="features-video-caption">
        <span>From box to dieline</span>
        <div className="features-video-scroll-controls">
          <span className="features-video-instruction"><ArrowDown aria-hidden="true" /> Scroll or drag to preview</span>
          <input className="features-video-timeline" type="range" min={0} max={100} step={1} defaultValue={0} aria-label="Box animation position" />
          <span className="features-video-percentage" aria-hidden="true">0%</span>
          <button type="button" onClick={skipAnimation}>Continue <ArrowDown aria-hidden="true" /></button>
        </div>
      </figcaption>
    </figure>
  );
}
