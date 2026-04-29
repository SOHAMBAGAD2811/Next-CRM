'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const user = localStorage.getItem('nexcrm_user');
    
    const publicRoutes = ['/', '/login', '/customer-portal', '/feedback'];
    const isPublic = publicRoutes.includes(pathname);

    if (!user && !isPublic) {
      router.push('/login');
    } else {
      if (user) {
        try {
          JSON.parse(user);
        } catch (e) {
          // Prevent crash if browser storage has invalid data
          localStorage.removeItem('nexcrm_user');
          if (!isPublic) {
            router.push('/login');
            return;
          }
        }
      }
      setAuthorized(true);
    }
  }, [pathname, router]);

  if (!authorized) {
    return <div style={{ height: '100vh', background: '#e0dcd1' }} />; // Prevents React hydration crash
  }

  // Render public pages cleanly without the sidebar
  const noSidebarRoutes = ['/', '/login', '/customer-portal', '/feedback'];
  if (noSidebarRoutes.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="layout">
      <Sidebar />
      <main className="main">{children}</main>
    </div>
  );
}