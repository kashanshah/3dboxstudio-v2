import type { Metadata } from 'next';
import { AdminPageHeader } from '@/components/admin-page-header';
import { getExportFeedbackStats,listExportFeedback } from '@/server/export-feedback';
export const metadata:Metadata={title:'Admin — Feedback'};
export const dynamic='force-dynamic';
export default async function FeedbackPage(){
  const [stats,items]=await Promise.all([getExportFeedbackStats(),listExportFeedback()]);
  return <><AdminPageHeader title="Export feedback" description="Ratings and optional comments collected after successful downloads."/>
    <div className="admin-panel" style={{padding:20,marginBottom:20}}>
      <h2 style={{margin:'0 0 12px'}}>Overview</h2>
      <div style={{display:'flex',gap:30,flexWrap:'wrap'}}>
        <div><strong style={{fontSize:28}}>{Number(stats.average).toFixed(1)} / 5</strong><p>Average rating</p></div>
        <div><strong style={{fontSize:28}}>{stats.total}</strong><p>Ratings</p></div>
        <div><strong style={{fontSize:28}}>{stats.comments}</strong><p>Written comments</p></div>
      </div>
      <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>{[stats.one,stats.two,stats.three,stats.four,stats.five].map((count,i)=><span key={i}>{i+1} ★: <strong>{count}</strong></span>)}</div>
    </div>
    <div className="admin-panel"><div className="admin-panel-header"><h2>Recent submissions</h2><p>{items.length} most recent</p></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Date</th><th>Rating</th><th>Feedback</th><th>Export</th><th>Template</th><th>User</th></tr></thead>
      <tbody>{items.length?items.map(item=><tr key={item.id}><td>{new Date(item.createdAt).toLocaleString()}</td><td>{'★'.repeat(item.rating)}{'☆'.repeat(5-item.rating)}</td><td className="admin-message">{item.comment||'—'}</td><td>{item.format.toUpperCase()}</td><td>{item.templateId}</td><td>{item.email||'Guest'}</td></tr>):<tr><td colSpan={6}>No feedback yet.</td></tr>}</tbody></table></div></div></>;
}
