import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar.jsx';
import Topbar from './Topbar.jsx';
import SubscriptionWarningBanner from '../components/SubscriptionWarningBanner.jsx';
import ZhaDentalAiBot from '../components/ai/ZhaDentalAiBot.jsx';

const STORAGE_KEY = 'zhanx.sidebarCollapsed';

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(STORAGE_KEY) === '1');
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, collapsed ? '1' : '0');
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Close mobile drawer on route change & scroll to top
  useEffect(() => {
    setMobileOpen(false);
    const main = document.getElementById('main-content');
    if (main) main.scrollTop = 0;
  }, [pathname]);

  // Lock scroll on mobile when sidebar is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  return (
    <div className="relative min-h-screen max-w-[100vw] overflow-x-hidden bg-slate-50/70 font-sans text-slate-800 transition-colors dark:bg-slate-950 dark:text-slate-100">
      {/* Background ambient dental glows */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-40 right-0 h-96 w-96 rounded-full bg-primary-200/20 blur-3xl dark:bg-primary-900/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none fixed bottom-0 left-64 h-96 w-96 rounded-full bg-cyan-200/20 blur-3xl dark:bg-cyan-950/10"
      />

      {/* Mobile Backdrop Overlay */}
      {mobileOpen && (
        <div
          role="presentation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs transition-opacity duration-300 lg:hidden"
          aria-hidden="true"
        />
      )}

      {/* Sidebar (Responsive drawer on mobile, fixed collapsed/expanded on desktop) */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((v) => !v)}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      {/* Main Content Area */}
      <div
        className={`flex min-h-screen min-w-0 flex-col transition-all duration-300 ml-0 ${
          collapsed ? 'lg:ml-[78px]' : 'lg:ml-[276px]'
        }`}
      >
        <Topbar
          onToggleSidebar={() => setCollapsed((v) => !v)}
          onToggleMobile={() => setMobileOpen((v) => !v)}
        />

        <SubscriptionWarningBanner />

        <main className="flex-1 px-2.5 py-3 sm:px-4 sm:py-4 md:px-5 lg:px-6" id="main-content">
          <div key={pathname} className="mx-auto w-full max-w-[1680px]">
            {children}
          </div>
        </main>
      </div>

      {/* Floating AI Dental Pet & Practice Guide Bot */}
      <ZhaDentalAiBot />
    </div>
  );
}
