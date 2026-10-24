/** A client share's own name and logo, shown instead of 3D Box Studio's (src/server/client-shares.ts). */
export type ShareBrand = { name: string | null; logoUrl: string | null };

export const BRAND_NAME_MAX = 60;
export const SHARE_PASSWORD_MIN = 4;
export const SHARE_PASSWORD_MAX = 128;
