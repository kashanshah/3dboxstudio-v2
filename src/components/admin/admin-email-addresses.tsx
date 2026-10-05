import { Fragment } from 'react';
import Link from 'next/link';
import { adminEmailAddress } from '@/lib/admin-email-address';

export function AdminEmailAddresses({ addresses, userHrefs = {} }: { addresses: string[]; userHrefs?: Record<string, string> }) {
  const visibleAddresses = addresses.filter((address) => address.trim());
  if (!visibleAddresses.length) return <>—</>;
  return <>{visibleAddresses.map((address, index) => {
    const href = userHrefs[adminEmailAddress(address)];
    return <Fragment key={`${index}:${address}`}>
      {index > 0 && ', '}
      {href ? <Link href={href}>{address}</Link> : address}
    </Fragment>;
  })}</>;
}
