import type { CSSProperties } from 'react';
import styles from './home-experience.module.css';

export const studies = [
  { id: 'field', name: 'Field Coffee', kind: 'Coffee carton', color: '#f2ead9', ink: '#2449ae', category: 'Single origin', note: 'COLOMBIA / 340 G', width: 180, height: 258, depth: 82 },
  { id: 'mora', name: 'Mora Skin', kind: 'Skincare carton', color: '#e79776', ink: '#4f2920', category: 'Everyday essentials', note: 'RADIANT CARE / 50 ML', width: 150, height: 274, depth: 72 },
  { id: 'ode', name: 'Ode Objects', kind: 'Gift carton', color: '#323b73', ink: '#fff5e0', category: 'Objects for living', note: 'COLLECTION NO. 03', width: 215, height: 215, depth: 90 },
] as const;
export type Study = typeof studies[number];
export type Finish = 'matte' | 'paper' | 'gloss';
export type BoxView = 'angle' | 'front' | 'top';

export function StudyArtwork({ study, compact = false }: { study: Study; compact?: boolean }) {
  return <div className={`${styles.artwork} ${styles[study.id]} ${compact ? styles.compactArt : ''}`}><span className={styles.artCategory}>{study.category}</span><strong className={styles.artBrand}>{study.id === 'field' ? 'FIELD' : study.id === 'mora' ? 'MORA' : 'ode.'}</strong><div className={styles.artGraphic} aria-hidden="true"><i /><i /><i /></div><span className={styles.artNote}>{study.note}</span></div>;
}
export function BoxStudy({ study, color, finish = 'matte', view = 'angle', rotation = -26, small = false }: { study: Study; color?: string; finish?: Finish; view?: BoxView; rotation?: number; small?: boolean }) {
  const vars = { '--package-color': color || study.color, '--package-ink': study.ink, '--box-width': `${study.width}px`, '--box-height': `${study.height}px`, '--box-depth': `${study.depth}px`, '--box-angle': `${view === 'front' ? 0 : view === 'top' ? -15 : rotation}deg`, '--box-tilt': `${view === 'front' ? 0 : view === 'top' ? -52 : -12}deg` } as CSSProperties;
  return <div className={`${styles.boxStage} ${small ? styles.smallBox : ''}`} style={vars} role="img" aria-label={`${study.name}, ${finish} finish, ${view} view`}><div className={`${styles.box} ${styles[finish]}`}><div className={`${styles.face} ${styles.front}`}><StudyArtwork study={study} /></div><div className={`${styles.face} ${styles.back}`} /><div className={`${styles.face} ${styles.left}`} /><div className={`${styles.face} ${styles.right}`}><span>{study.name}<small>THOUGHTFULLY MADE</small></span></div><div className={`${styles.face} ${styles.top}`}><span>{study.id.toUpperCase()}</span></div><div className={`${styles.face} ${styles.bottom}`} /></div><div className={styles.boxShadow} aria-hidden="true" /></div>;
}
