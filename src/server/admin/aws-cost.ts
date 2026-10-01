import { CostExplorerClient, GetCostAndUsageCommand, GetCostForecastCommand } from '@aws-sdk/client-cost-explorer';
import { optionalEnv } from '@/server/env';

export type AwsServiceCost = { name: string; amount: number };
export type AwsCostEstimate = {
  available: boolean;
  currency: string;
  monthToDate: number;
  lastMonth: number | null;
  forecast: number | null;
  services: AwsServiceCost[];
  message?: string;
};

const SUCCESS_CACHE_MS = 6 * 60 * 60 * 1000;
const FAILURE_CACHE_MS = 5 * 60 * 1000;
let cache: { expires: number; value: AwsCostEstimate } | undefined;

function utcDate(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
}

function metricAmount(metric?: { Amount?: string; Unit?: string }) {
  const amount = Number(metric?.Amount);
  return { amount: Number.isFinite(amount) ? amount : 0, unit: metric?.Unit || 'USD' };
}

const empty = (message: string): AwsCostEstimate => ({
  available: false,
  currency: 'USD',
  monthToDate: 0,
  lastMonth: null,
  forecast: null,
  services: [],
  message,
});

export async function getAwsCost(): Promise<AwsCostEstimate> {
  if (cache && cache.expires > Date.now()) return cache.value;
  const accessKeyId = optionalEnv('AWS_ACCESS_KEY_ID');
  const secretAccessKey = optionalEnv('AWS_SECRET_ACCESS_KEY');
  if (!accessKeyId || !secretAccessKey) return empty('Configure AWS credentials to show estimated AWS cost.');

  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = now.getUTCDate();
  const client = new CostExplorerClient({ region: 'us-east-1', credentials: { accessKeyId, secretAccessKey } });
  try {
    const usage = await client.send(new GetCostAndUsageCommand({
      TimePeriod: { Start: utcDate(year, month - 1, 1), End: utcDate(year, month, day) },
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
    }), { abortSignal: AbortSignal.timeout(12000) });
    const periods = usage.ResultsByTime ?? [];
    const current = day === 1 ? undefined : periods.at(-1);
    const previous = day === 1 ? periods.at(-1) : periods.length > 1 ? periods[0] : undefined;
    const currentTotal = metricAmount(current?.Total?.UnblendedCost);
    const ranked = (current?.Groups ?? [])
      .map((group) => ({ name: group.Keys?.[0] || 'Other', amount: metricAmount(group.Metrics?.UnblendedCost).amount }))
      .filter((row) => row.amount >= 0.01)
      .sort((a, b) => b.amount - a.amount);
    const services = ranked.slice(0, 6);
    const other = ranked.slice(6).reduce((sum, row) => sum + row.amount, 0);
    if (other >= 0.01) services.push({ name: 'Other', amount: other });

    let forecast: number | null = null;
    const forecastStart = utcDate(year, month, day);
    const forecastEnd = utcDate(year, month + 1, 1);
    if (forecastStart < forecastEnd) {
      try {
        const predicted = await client.send(new GetCostForecastCommand({
          TimePeriod: { Start: forecastStart, End: forecastEnd },
          Metric: 'UNBLENDED_COST',
          Granularity: 'MONTHLY',
        }), { abortSignal: AbortSignal.timeout(12000) });
        forecast = metricAmount(predicted.Total).amount;
      } catch (error) {
        console.error('AWS cost forecast unavailable', error instanceof Error ? error.name : 'error');
      }
    }

    const value: AwsCostEstimate = {
      available: true,
      currency: currentTotal.unit,
      monthToDate: currentTotal.amount,
      lastMonth: previous ? metricAmount(previous.Total?.UnblendedCost).amount : null,
      forecast,
      services,
    };
    cache = { expires: Date.now() + SUCCESS_CACHE_MS, value };
    return value;
  } catch (error) {
    console.error('AWS cost estimate failed', error instanceof Error ? error.name : 'error');
    const value = empty('AWS cost is unavailable. The credentials need Cost Explorer access (ce:GetCostAndUsage and ce:GetCostForecast).');
    cache = { expires: Date.now() + FAILURE_CACHE_MS, value };
    return value;
  } finally {
    client.destroy();
  }
}
