export type ArtworkMode = 'fill' | 'fit' | 'tile';

export type ArtworkPlacement = {
  name: string;
  url: string;
  mode: ArtworkMode;
  scale: number;
  rotation: number;
  alignX: -1 | 0 | 1;
  alignY: -1 | 0 | 1;
};

export type ArtworkByPanel = Record<string, ArtworkPlacement>;

export function defaultArtworkPlacement(name: string, url: string): ArtworkPlacement {
  return {
    name,
    url,
    mode: 'fill',
    scale: 100,
    rotation: 0,
    alignX: 0,
    alignY: 0,
  };
}

export function artworkCss(artwork: ArtworkPlacement) {
  const positionX = artwork.alignX === -1 ? 'left' : artwork.alignX === 1 ? 'right' : 'center';
  const positionY = artwork.alignY === -1 ? 'top' : artwork.alignY === 1 ? 'bottom' : 'center';

  return {
    backgroundImage: `url("${artwork.url}")`,
    backgroundPosition: `${positionX} ${positionY}`,
    backgroundRepeat: artwork.mode === 'tile' ? 'repeat' : 'no-repeat',
    backgroundSize: artwork.mode === 'fill'
      ? 'cover'
      : artwork.mode === 'fit'
        ? 'contain'
        : `${Math.max(12, 10000 / Math.max(25, artwork.scale))}% auto`,
    transform: artwork.mode === 'tile'
      ? `rotate(${artwork.rotation}deg)`
      : `scale(${artwork.scale / 100}) rotate(${artwork.rotation}deg)`,
    transformOrigin: `${positionX} ${positionY}`,
  } as const;
}
