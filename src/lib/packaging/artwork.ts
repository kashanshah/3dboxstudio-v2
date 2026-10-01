export type ArtworkMode = 'fill' | 'fit' | 'tile';

export type LocalMediaAsset = {
  id: string;
  name: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  fingerprint: string;
  createdAt: number;
};

export type ArtworkCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ArtworkPlacement = {
  panelTexture?: boolean;
  transform?: {x:number;y:number;width:number;height:number;rotation:number};
  assetId?: string;
  crop?: ArtworkCrop;
  name: string;
  url: string;
  mode: ArtworkMode;
  scale: number;
  rotation: number;
  alignX: -1 | 0 | 1;
  alignY: -1 | 0 | 1;
};

export type ArtworkByPanel = Record<string, ArtworkPlacement>;

export function defaultArtworkPlacement(name: string, url: string, assetId?: string): ArtworkPlacement {
  return {
    assetId,
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
  if (artwork.transform) {
    const t=artwork.transform;
    return {inset:'auto',left:`${t.x}%`,top:`${t.y}%`,width:`${t.width}%`,height:`${t.height}%`,backgroundImage:`url("${artwork.url}")`,backgroundSize:'100% 100%',backgroundRepeat:'no-repeat',transform:`translate(-50%,-50%) rotate(${t.rotation}deg)`,transformOrigin:'center'} as const;
  }
  const positionX = artwork.alignX === -1 ? 'left' : artwork.alignX === 1 ? 'right' : 'center';
  const positionY = artwork.alignY === -1 ? 'top' : artwork.alignY === 1 ? 'bottom' : 'center';

  const cropStyle = artwork.crop ? artworkCropCss(artwork.crop) : {};
  return {
    backgroundImage: `url("${artwork.url}")`,
    backgroundPosition: `${positionX} ${positionY}`,
    backgroundRepeat: artwork.mode === 'tile' ? 'repeat' : 'no-repeat',
    backgroundSize: artwork.panelTexture ? '100% 100%' : artwork.mode === 'fill'
      ? 'cover'
      : artwork.mode === 'fit'
        ? 'contain'
        : `${Math.max(12, 10000 / Math.max(25, artwork.scale))}% auto`,
    transform: artwork.mode === 'tile'
      ? `rotate(${artwork.rotation}deg)`
      : `scale(${artwork.scale / 100}) rotate(${artwork.rotation}deg)`,
    transformOrigin: `${positionX} ${positionY}`,
    ...cropStyle,
  } as const;
}


export function artworkCropCss(crop: ArtworkCrop) {
  return {
    backgroundSize: `${100 / crop.width}% ${100 / crop.height}%`,
    backgroundPosition: `${crop.width >= 1 ? 0 : crop.x / (1 - crop.width) * 100}% ${crop.height >= 1 ? 0 : crop.y / (1 - crop.height) * 100}%`,
    backgroundRepeat: 'no-repeat',
  } as const;
}
