import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/server/auth/session';
import { AccountPage } from '@/components/auth/account-page';
export const metadata:Metadata={title:'Your account',robots:{index:false,follow:false}};
export default async function Page(){const user=await getCurrentUser();if(!user)redirect('/login?next=%2Faccounts');return <AccountPage initialUser={user}/>;}
