'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import styles from './zoom-image.module.css';

type Shot = { src: string; alt: string };

type Gallery = {
  register: (shot: Shot) => number;
  open: (index: number) => void;
};

const ZoomGalleryContext = createContext<Gallery | null>(null);

export function ZoomGallery({ children }: { children: React.ReactNode }) {
  const shots = useRef<Shot[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const register = useCallback((shot: Shot) => {
    const existing = shots.current.findIndex((item) => item.src === shot.src);
    if (existing >= 0) return existing;
    shots.current.push(shot);
    return shots.current.length - 1;
  }, []);
  const open = useCallback((index: number) => setActive(index), []);

  return (
    <ZoomGalleryContext.Provider value={{ register, open }}>
      {children}
      {active !== null && (
        <Lightbox
          shots={shots.current}
          index={active}
          onIndex={setActive}
          onClose={() => setActive(null)}
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
  const index = useRef(-1);
  if (gallery && index.current < 0) index.current = gallery.register({ src, alt });

  return (
    <div className={styles.frame}>
      <button type="button" className={styles.trigger} aria-label={`View full screen: ${alt}`} onClick={() => gallery?.open(index.current)}>
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
