'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import styles from './zoom-image.module.css';

type Shot = { src: string; alt: string };

type Gallery = {
  register: (shot: Shot) => void;
  open: (shot: Shot) => void;
};

const ZoomGalleryContext = createContext<Gallery | null>(null);

export function ZoomGallery({ children }: { children: React.ReactNode }) {
  const [shots, setShots] = useState<Shot[]>([]);
  const [activeSrc, setActiveSrc] = useState<string | null>(null);
  const register = useCallback((shot: Shot) => {
    setShots((current) => current.some((item) => item.src === shot.src) ? current : [...current, shot]);
  }, []);
  const open = useCallback((shot: Shot) => {
    setShots((current) => current.some((item) => item.src === shot.src) ? current : [...current, shot]);
    setActiveSrc(shot.src);
  }, []);
  const active = activeSrc === null ? null : shots.findIndex((shot) => shot.src === activeSrc);

  return (
    <ZoomGalleryContext.Provider value={{ register, open }}>
      {children}
      {active !== null && active >= 0 && (
        <Lightbox
          shots={shots}
          index={active}
          onIndex={(index) => setActiveSrc(shots[index]?.src ?? null)}
          onClose={() => setActiveSrc(null)}
        />
      )}
    </ZoomGalleryContext.Provider>
  );
}

export function ZoomImage({
  src,
  alt,
  width,
  height,
  sizes,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
}) {
  const gallery = useContext(ZoomGalleryContext);

  useEffect(() => {
    gallery?.register({ src, alt });
  }, [gallery, src, alt]);

  return (
    <div className={styles.frame}>
      <button type="button" className={styles.trigger} aria-label={`View full screen: ${alt}`} onClick={() => gallery?.open({ src, alt })}>
        <Image src={src} alt={alt} width={width} height={height} sizes={sizes} />
      </button>
      <span className={styles.magnify} aria-hidden="true"><ZoomIn size={18} /></span>
    </div>
  );
}

function Lightbox({
  shots,
  index,
  onIndex,
  onClose,
}: {
  shots: Shot[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const shot = shots[index];
  const several = shots.length > 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
      // Strict Mode runs this cleanup before the effect runs again. Closing must not
      // also clear React state, or the dialog unmounts before it can reopen.
      if (dialog.open) dialog.close();
    };
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!several) return;
      if (event.key === 'ArrowRight') onIndex((index + 1) % shots.length);
      if (event.key === 'ArrowLeft') onIndex((index - 1 + shots.length) % shots.length);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [index, onIndex, several, shots.length]);

  if (!shot) return null;

  return (
    <dialog
      ref={dialogRef}
      className={styles.lightbox}
      aria-label={shot.alt}
      onCancel={(event) => { event.preventDefault(); onClose(); }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <button type="button" className={styles.close} aria-label="Close" onClick={onClose}><X size={20} /></button>
      {several && (
        <button type="button" className={styles.prev} aria-label="Previous image" onClick={(event) => { event.stopPropagation(); onIndex((index - 1 + shots.length) % shots.length); }}>
          <ChevronLeft size={22} />
        </button>
      )}
      <img src={shot.src} alt={shot.alt} onClick={(event) => event.stopPropagation()} />
      {several && (
        <button type="button" className={styles.next} aria-label="Next image" onClick={(event) => { event.stopPropagation(); onIndex((index + 1) % shots.length); }}>
          <ChevronRight size={22} />
        </button>
      )}
    </dialog>
  );
}
