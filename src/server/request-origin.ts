export function requestOrigin(req:Request){
  const forwardedHost=req.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host=forwardedHost||req.headers.get('host');
  const forwardedProto=req.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
  if(host) return `${forwardedProto||new URL(req.url).protocol.replace(':','')}://${host}`;
  return new URL(req.url).origin;
}
