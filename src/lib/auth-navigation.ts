export function safeReturnTo(value:unknown,fallback='/studio') {
 if(typeof value!=='string'||!value.startsWith('/')||value.startsWith('//')||/[\\\u0000-\u001f]/.test(value))return fallback;
 try{const url=new URL(value,'https://internal.invalid');if(url.origin!=='https://internal.invalid'||/^\/(login|signup|forgot-password|reset-password)(\/|$)/.test(url.pathname))return fallback;return url.pathname+url.search+url.hash;}catch{return fallback;}
}
