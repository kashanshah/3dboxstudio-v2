import { METRIC_LABELS } from './campaign-api';
export function CampaignMetricCards({ metrics }: { metrics: Record<string,number|string|null> }) {
  return <div className="campaign-metrics">{['sent','delivered','unique_opened','unique_clicked','bounced','complained','unsubscribed','suppressed'].map(key=><div className="campaign-metric" key={key}><span>{METRIC_LABELS[key]}</span><strong>{Number(metrics[key] || 0).toLocaleString()}</strong></div>)}</div>;
}
