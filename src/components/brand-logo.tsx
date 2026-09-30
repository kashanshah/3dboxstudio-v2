import Image from 'next/image';

type BrandLogoProps = {
  compact?: boolean;
  tone?: 'light' | 'dark';
  className?: string;
  priority?: boolean;
};

export function BrandLogo({ compact = false, tone = 'light', className, priority = false }: BrandLogoProps) {
  const src = compact
    ? `/brand/logo-mark-${tone}.svg`
    : `/brand/logo-horizontal-${tone}.svg`;
  const width = compact ? 56 : 206;
  return <Image
    src={src}
    alt="3D Box Studio"
    width={width}
    height={56}
    className={className}
    priority={priority}
    unoptimized
  />;
}
