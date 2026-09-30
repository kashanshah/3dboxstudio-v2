import Link from "next/link";
import { ArrowRight, Box, Check, Move, Maximize2, RotateCw, Upload, Waypoints } from "lucide-react";
import { PackageBox } from "@/components/original-package-box";
import { Button } from "@/components/original-button";

const steps = [
  { icon: Box, title: "Start from the flat dieline", text: "Every panel, fold and glue flap of your chosen structure, laid out in 2D." },
  { icon: Upload, title: "Drop in artwork of any size", text: "Logos, full-bleed patterns or photography — no pre-cropping required." },
  { icon: Move, title: "Move, resize, rotate in place", text: "Transform artwork directly over the dieline, like a lightweight layer edit." },
  { icon: Check, title: "Apply the composition", text: "Lock in the layout once it reads right across the flat sheet." },
  { icon: Waypoints, title: "Mapped to every 3D panel", text: "The exact placement wraps onto the matching faces of the package." },
  { icon: RotateCw, title: "Fold, rotate and review", text: "Turn the finished carton in 3D to check seams, edges and first impressions." },
];

function DielineIllustration() {
  return (
    <svg viewBox="0 0 360 300" className="dl-svg" aria-hidden="true">
      <defs>
        <pattern id="dl-grid" width="12" height="12" patternUnits="userSpaceOnUse">
          <path d="M12 0H0V12" className="dl-grid" />
        </pattern>
        <clipPath id="dl-clip">
          <rect x="130" y="20" width="80" height="60" />
          <rect x="10" y="80" width="320" height="100" />
          <rect x="130" y="180" width="80" height="60" />
        </clipPath>
      </defs>
      <rect width="360" height="300" fill="url(#dl-grid)" />
      <path d="M330 90l18 8v64l-18 8z" className="dl-flap" />
      <path d="M140 20l8-14h44l8 14z" className="dl-flap" />
      <path d="M140 240l8 14h44l8-14z" className="dl-flap" />
      <rect x="130" y="20" width="80" height="60" className="dl-panel" />
      <rect x="10" y="80" width="320" height="100" className="dl-panel" />
      <rect x="130" y="180" width="80" height="60" className="dl-panel" />
      <g clipPath="url(#dl-clip)">
        <g transform="rotate(-8 176 128)">
          <rect x="96" y="70" width="160" height="116" rx="4" className="dl-art" />
          <circle cx="210" cy="104" r="26" className="dl-art-sun" />
          <path d="M96 170c30-26 58-30 82-14s50 12 78-8v38H96z" className="dl-art-wave" />
          <text x="112" y="120" className="dl-art-type">NOMA</text>
        </g>
      </g>
      <path d="M90 80v100M130 80v100M210 80v100M250 80v100M130 80h80M130 180h80" className="dl-fold" />
      <rect x="10" y="80" width="320" height="100" className="dl-cut" />
      <rect x="130" y="20" width="80" height="60" className="dl-cut" />
      <rect x="130" y="180" width="80" height="60" className="dl-cut" />
      <g transform="rotate(-8 176 128)" className="dl-bbox">
        <rect x="96" y="70" width="160" height="116" />
        <line x1="176" y1="70" x2="176" y2="48" />
        <circle cx="176" cy="44" r="5" className="dl-rot" />
        {([[96,70],[176,70],[256,70],[256,128],[256,186],[176,186],[96,186],[96,128]] as const).map(([x,y]) => (
          <rect key={`${x}-${y}`} x={x-4} y={y-4} width="8" height="8" className="dl-handle" />
        ))}
      </g>
      <text x="138" y="140" className="dl-label">FRONT</text>
    </svg>
  );
}

export function DielineWorkflowSection() {
  return (
    <section className="dl-section" aria-labelledby="dl-title">
      <div className="dl-intro">
        <div>
          <p className="eyebrow">2D dieline → 3D package</p>
          <h2 id="dl-title">Design flat.<br />Review folded.</h2>
        </div>
        <div className="dl-intro-side">
          <p>Compose artwork directly on your package’s flat dieline — move, resize and rotate it freely — then see that exact placement wrapped across the matching panels of the folded carton.</p>
          <Button asChild size="lg"><Link href="/studio">Open Studio <ArrowRight /></Link></Button>
        </div>
      </div>

      <div className="dl-stage">
        <figure className="dl-pane dl-pane-2d">
          <div className="dl-pane-bar"><span>Dieline · Tuck-end carton</span><b>2D</b></div>
          <div className="dl-canvas"><DielineIllustration /></div>
          <div className="dl-toolbar" role="list" aria-label="Transform tools">
            {[[Move,"Move"],[Maximize2,"Resize"],[RotateCw,"Rotate −8°"]].map(([Icon,label],i) => {
              const I=Icon as typeof Move;
              return <span role="listitem" key={i} className={i===0?"is-active":""}><I aria-hidden="true"/>{label as string}</span>;
            })}
            <span role="listitem" className="dl-dims">W 160 · H 116</span>
          </div>
          <figcaption className="sr-only">A flat carton dieline with artwork selected, showing a bounding box, resize handles and a rotation handle.</figcaption>
        </figure>

        <div className="dl-bridge" aria-hidden="true">
          <svg viewBox="0 0 120 60" preserveAspectRatio="none"><path d="M0 30C40 30 50 8 60 8s20 44 60 22"/></svg>
          <span className="dl-bridge-chip"><Waypoints/>Map to panels</span>
        </div>

        <figure className="dl-pane dl-pane-3d">
          <div className="dl-pane-bar"><span>Folded preview</span><b>3D</b></div>
          <div className="dl-canvas dl-canvas-3d"><PackageBox artwork={"NOMA\nTEA"} /></div>
          <div className="dl-toolbar"><span className="is-active"><Box aria-hidden="true"/>Orbit</span><span><Check aria-hidden="true"/>Placement matched</span></div>
          <figcaption className="sr-only">The same artwork wrapped onto the front and side panels of a folded 3D carton.</figcaption>
        </figure>
      </div>

      <ol className="dl-steps">
        {steps.map(({icon:Icon,title,text},i)=>(
          <li key={title}>
            <span className="dl-step-num">{String(i+1).padStart(2,"0")}</span>
            <span className="dl-step-icon"><Icon aria-hidden="true"/></span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <p className="dl-note">Works with the package structures available in Studio; artwork is composed on the structure’s existing dieline.</p>
    </section>
  );
}
