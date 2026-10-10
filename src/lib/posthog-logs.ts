import { logs,SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor,LoggerProvider } from '@opentelemetry/sdk-logs';
import { after } from 'next/server';

const token=process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const host=process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
// node:test sets NODE_TEST_CONTEXT in worker processes and does not set NODE_ENV.
const runningTests=process.env.NODE_ENV==='test'||process.env.NODE_TEST_CONTEXT!==undefined;

function missingPostHogConfig():string|null{
  if(token&&host)return null;
  if(process.env.NODE_ENV==='production'||runningTests)return null;
  return !token?'NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN':'NEXT_PUBLIC_POSTHOG_HOST';
}

export const posthogLogProvider=token&&host?new LoggerProvider({
  resource:resourceFromAttributes({
    'service.name':'3dboxstudio-web',
    'deployment.environment':process.env.NODE_ENV??'unknown',
  }),
  processors:[new BatchLogRecordProcessor({
    exporter:new OTLPLogExporter({
      url:`${host.replace(/\/$/,'')}/i/v1/logs`,
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
    }),
  })],
}):null;

const posthogLogger=posthogLogProvider?.getLogger('3dboxstudio-product-operations');

export function registerPostHogLogs():void{
  const variable=missingPostHogConfig();
  // Analytics are optional in development (.env.example: leave the token
  // empty to disable); a missing variable is reported, not fatal, so
  // `npm run dev` works without credentials as the README promises.
  if(variable)console.warn(`${variable} is not configured, so PostHog logs are off and server events are not recorded. Set it in .env.local to turn them on.`);
  if(posthogLogProvider)logs.setGlobalLoggerProvider(posthogLogProvider);
}

export function emitPostHogLog(
  body:string,
  attributes:Record<string,string|number|boolean>,
  severityNumber:SeverityNumber=SeverityNumber.INFO,
):void{
  if(!posthogLogger||!posthogLogProvider)return;
  posthogLogger.emit({body,severityNumber,attributes});
  after(async()=>{await posthogLogProvider.forceFlush();});
}
