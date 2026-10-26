export function isValidEmail(value:unknown):value is string{
  return typeof value==='string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim()) && value.length<=320;
}
/**
 * For new sign-ups, also what our email provider accepts: no dot at either
 * end of the name part or two in a row (Resend refuses those, so the
 * verification email never arrives). Usually a typo, so the message says what
 * to look at. Sign-in keeps the looser check, for accounts made before.
 */
export function signupEmailError(value:unknown):string|null{
  if(!isValidEmail(value)) return 'Enter a valid email address.';
  const [local,domain]=[value.trim().slice(0,value.trim().lastIndexOf('@')),value.trim().slice(value.trim().lastIndexOf('@')+1)];
  if(local.includes('..')||domain.includes('..')) return 'Check your email address: it has two dots in a row.';
  if(local.startsWith('.')||local.endsWith('.')||domain.startsWith('.')||domain.startsWith('-')) return 'Check your email address: a dot can’t come right before the @ or at the start.';
  return null;
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
