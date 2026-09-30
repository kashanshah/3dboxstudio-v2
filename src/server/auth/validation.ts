export function isValidEmail(value:unknown):value is string{
  return typeof value==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length<=320;
}
export function cleanName(value:unknown){
  if(typeof value!=='string') return null;
  const name=value.trim().replace(/\s+/g,' ');
  return name?name.slice(0,120):null;
}
export function passwordError(value:unknown){
  if(typeof value!=='string') return 'Enter a password.';
  if(value.length<8) return 'Use at least 8 characters.';
  if(value.length>200) return 'Password is too long.';
  return null;
}
