import { logs,SeverityNumber } from '@opentelemetry/api-logs';
import { OTLPLogExporter } from '@opentelemetry/exporter-logs-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { BatchLogRecordProcessor,LoggerProvider } from '@opentelemetry/sdk-logs';
import { after } from 'next/server';

const token=process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN?.trim();
const host=process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

if((!token||!host)&&process.env.NODE_ENV!=='production'){
  const variable=!token?'next_PUBLIC_POSTHOG_PROJECT_TOKEN':'next_PUBLIC_POSTHOG_HOST';
  throw new Error(`${variable} environment variable required by PostHog is missing or un-configured, this causes events to be silently missed. This error stops appearing once ${variable} is configured`);
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
