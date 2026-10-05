// EEA members, plus the UK and Switzerland: analytics cookies need opt-in consent there.
const CONSENT_REQUIRED_COUNTRIES=new Set([
  'AT','BE','BG','HR','CY','CZ','DK','EE','FI','FR','DE','GR','HU','IE','IT','LV','LT','LU','MT','NL','PL','PT','RO','SK','SI','ES','SE',
  'IS','LI','NO','GB','CH',
]);

export function consentRequiredFor(country:string|null|undefined){
  const code=country?.trim().toUpperCase();
  // Unknown location: ask, rather than assume consent.
  return !code||CONSENT_REQUIRED_COUNTRIES.has(code);
}
