import Link from "next/link";

/** Side-by-side comparison for the "alternative" pages. Keep rows factual and dated. */
export function CompareTable({ competitor, rows, checked }: { competitor: string; rows: { label: string; ours: string; theirs: string }[]; checked: string }) {
  return <section className="compare-table" aria-labelledby="compare-table-title">
    <h2 id="compare-table-title">3D Box Studio vs {competitor}</h2>
    <div className="compare-table-scroll">
      <table>
        <thead><tr><th scope="col"><span className="sr-only">Feature</span></th><th scope="col">3D Box Studio</th><th scope="col">{competitor}</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.label}><th scope="row">{row.label}</th><td data-label="3D Box Studio">{row.ours}</td><td data-label={competitor}>{row.theirs}</td></tr>)}</tbody>
      </table>
    </div>
    <p>{checked}</p>
  </section>;
}

const COMPARISONS = [
  { href: "/pacdora-alternative", label: "Pacdora" },
  { href: "/adobe-dimension-alternative", label: "Adobe Dimension" },
  { href: "/boxshot-alternative", label: "Boxshot" },
  { href: "/placeit-box-mockup-alternative", label: "Placeit" },
];

/** Links between the comparison pages. */
export function ComparisonLinks({ current }: { current: string }) {
  return <nav className="comparison-links" aria-label="Other comparisons">
    <span>Compare with:</span>
    {COMPARISONS.filter(item => item.href !== current).map(item => <Link key={item.href} href={item.href}>{item.label}</Link>)}
  </nav>;
}
