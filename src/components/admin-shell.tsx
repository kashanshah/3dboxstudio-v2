'use client'; import Link from 'next/link'; import { Box } from 'lucide-react'; import { usePathname,useRouter } from 'next/navigation';
const NAV=[{href:'/admin',label:'Dashboard',exact:true},{href:'/admin/users',label:'Users'},{href:'/admin/designs',label:'Designs'},{href:'/admin/media',label:'Media'},{href:'/admin/contacts',label:'Contacts'},{href:'/admin/emails',label:'Emails'},{href:'/admin/settings',label:'Settings'}];
export function AdminShell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const router=useRouter();
  const designPreview=/^\/admin\/designs\/[^/]+\/view\/?$/.test(path);
  async function logout(){await fetch('/api/admin/logout',{method:'POST'});router.push('/');router.refresh();}
  if(designPreview)return <div className="admin-shell admin-shell-design-preview">{children}</div>;
  return <div className="admin-shell"><aside className="admin-sidebar"><Link className="admin-brand" href="/admin"><span className="admin-brand-mark"><Box size={17}/></span><span>3D Box Studio Admin</span></Link><nav className="admin-nav">{NAV.map(item=>{const active=item.exact?path===item.href:path.startsWith(item.href);return <Link key={item.href} href={item.href} aria-current={active?'page':undefined}>{item.label}</Link>})}</nav><div className="admin-sidebar-footer"><button className="admin-logout" onClick={()=>void logout()}>Sign out</button></div></aside><main className="admin-main">{children}</main></div>;
}
