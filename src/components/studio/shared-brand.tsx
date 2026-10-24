import type { ShareBrand } from '@/lib/share-brand';

/** The owner's logo and name on a client share, in place of 3D Box Studio's. */
export function SharedBrand({brand}:{brand:ShareBrand}){
  return <span className="shared-brand">
    {/* eslint-disable-next-line @next/next/no-img-element -- the owner's uploaded logo, served from the share's own media route */}
    {brand.logoUrl&&<img src={brand.logoUrl} alt={brand.name??'Logo'}/>}
    {brand.name&&!brand.logoUrl&&<b>{brand.name}</b>}
  </span>;
}
