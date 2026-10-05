export function adminEmailAddress(address: string): string {
  const mailbox = address.match(/<([^<>]+)>\s*$/)?.[1] ?? address;
  return mailbox.trim().toLowerCase();
}
