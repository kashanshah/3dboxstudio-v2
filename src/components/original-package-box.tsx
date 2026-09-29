const cn = (...values: (string | boolean | undefined)[]) => values.filter(Boolean).join(" ");

export function PackageBox({ className, open = false, artwork = "SIGNAL\nOBJECTS" }: { className?: string; open?: boolean; artwork?: string }) {
  return (
    <div className={cn("package-stage", className)} aria-label="3D packaging box preview">
      <div className={cn("package-cube", open && "is-open")}>
        <div className="package-face package-front">
          <span className="package-kicker">Edition 02</span>
          <span className="package-artwork">{artwork}</span>
          <span className="package-dot" />
        </div>
        <div className="package-face package-side">
          <span className="package-side-copy">Designed to be held</span>
        </div>
        <div className="package-face package-top">
          <span className="package-top-mark">S/O</span>
        </div>
        <div className="package-shadow" />
      </div>
    </div>
  );
}

