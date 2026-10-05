"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Box, Boxes, ImageIcon } from "lucide-react";

const STEPS = [
  {
    id: "box",
    label: "Box",
    detail: "Structure, size & finish",
    caption: "Pick a template, enter finished dimensions in mm or inches, and choose the board material.",
    src: "/images/v2-launch/studio-box-size.png",
    alt: "3D Box Studio Box & Size panel with width, height and depth inputs beside a kraft carton in 3D",
    Icon: Box,
  },
  {
    id: "design",
    label: "Design",
    detail: "Artwork & print layout",
    caption: "Place artwork on the flat dieline with cut, crease and bleed guides while a live 3D view updates.",
    src: "/images/v2-launch/studio-design-artwork.png",
    alt: "3D Box Studio design canvas showing artwork layers placed on a box dieline with a live 3D preview",
    Icon: ImageIcon,
  },
  {
    id: "preview",
    label: "Preview & Download",
    detail: "3D review & output",
    caption: "Fold the box from flat to closed, orbit it in 3D, then export a PNG mockup or share a preview link.",
    src: "/images/v2-launch/studio-preview-3d.png",
    alt: "3D Box Studio preview of a printed, fully assembled box with the flat-to-closed assembly control",
    Icon: Boxes,
  },
] as const;

/** Screenshot tour of the real Studio, used instead of embedding the sign-in gated app. */
export function StudioTour() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];
  return <div className="mpp-frame mpp-tour">
    <div className="mpp-framebar"><span/><span/><span/><b>3D Box Studio</b><Link href="/studio">Open Studio <ArrowRight/></Link></div>
    <div className="mpp-tour-steps" role="tablist" aria-label="Studio workflow">
      {STEPS.map((item, index) => <button key={item.id} type="button" role="tab" id={`mpp-tour-tab-${item.id}`}
        aria-selected={index === active} aria-controls="mpp-tour-panel" onClick={() => setActive(index)}>
        <i>{index + 1}</i><item.Icon aria-hidden="true"/><span><b>{item.label}</b><small>{item.detail}</small></span>
      </button>)}
    </div>
    <div className="mpp-tour-panel" id="mpp-tour-panel" role="tabpanel" aria-labelledby={`mpp-tour-tab-${step.id}`}>
      <div className="mpp-tour-shots">
        {STEPS.map((item, index) => <Image key={item.id} src={item.src} alt={item.alt} width={2048} height={1144}
          sizes="(max-width: 1100px) 100vw, 760px" className={index === active ? "is-active" : undefined}
          aria-hidden={index !== active} />)}
      </div>
      <p className="mpp-tour-caption">{step.caption}</p>
    </div>
  </div>;
}
