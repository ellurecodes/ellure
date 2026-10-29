import React, { useState, useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Wallet,
  Briefcase,
  GraduationCap,
  HeartPulse,
  Target,
  CalendarCheck2,
  FileSpreadsheet,
  Settings,
  Trash2,
  Plus,
  Search,
  Sun,
  Moon,
  ShieldCheck,
  Menu,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { GlobalSearch } from '../shared/GlobalSearch';
import { QuickAddModal } from '../shared/QuickAddModal';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';

export function AppLayout() {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('lifeos_theme') as any) || 'system';
  });

  const location = useLocation();
  const settings = useLiveQuery(() => db.settings.get('current_user_settings'));

  // Theme application
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
      localStorage.setItem('lifeos_theme', 'dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
      localStorage.setItem('lifeos_theme', 'light');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
      localStorage.setItem('lifeos_theme', 'system');
    }
  }, [theme]);

  // Global Ctrl+K handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/agenda', label: 'Agenda', icon: CalendarCheck2 },
    { to: '/finance', label: 'Finance', icon: Wallet },
    { to: '/earnings', label: 'Online Earnings', icon: Briefcase },
    { to: '/academics', label: 'Academics', icon: GraduationCap },
    { to: '/habits', label: 'Fitness & Habits', icon: HeartPulse },
    { to: '/goals', label: 'Goals', icon: Target },
    { to: '/reports', label: 'Reports', icon: FileSpreadsheet },
    { to: '/trash', label: 'Trash', icon: Trash2 },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row antialiased">
      {/* DESKTOP & TABLET SIDEBAR */}
      <aside
        className={twMerge(
          clsx(
            'hidden md:flex flex-col border-r border-border bg-card/60 backdrop-blur shrink-0 transition-all duration-200 z-30 select-none sticky top-0 h-screen',
            isSidebarCollapsed ? 'w-16' : 'w-60'
          )
        )}
      >
        {/* Brand Header */}
        <div className="h-14 flex items-center justify-between px-3.5 border-b border-border">
          {!isSidebarCollapsed && (
            <div className="flex items-center space-x-2.5 overflow-hidden">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-xs shadow-sm">
                OS
              </div>
              <div>
                <span className="font-bold text-sm tracking-tight text-foreground block">LifeOS</span>
                <span className="text-[10px] text-muted-foreground block -mt-1">Command Center</span>
              </div>
            </div>
          )}
          {isSidebarCollapsed && (
            <div className="w-8 h-8 mx-auto rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-black text-xs shadow-sm">
              OS
            </div>
          )}
          <button
            onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            className="p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground hidden lg:flex items-center justify-center transition-colors"
            title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Quick Add CTA on Sidebar */}
        <div className="p-2.5">
          <button
            onClick={() => setIsQuickAddOpen(true)}
            className={twMerge(
              clsx(
                'w-full flex items-center justify-center bg-primary text-primary-foreground hover:bg-primary/90 font-medium py-2 rounded-lg text-xs shadow-sm transition-all',
                isSidebarCollapsed ? 'px-0' : 'space-x-2 px-3'
              )
            )}
            title="Quick Add Record"
          >
            <Plus className="w-4 h-4" />
            {!isSidebarCollapsed && <span>Quick Add</span>}
          </button>
        </div>

        {/* Navigation items */}
        <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
          {navLinks.map(link => {
            const Icon = link.icon;
            return (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  twMerge(
                    clsx(
                      'flex items-center rounded-lg text-xs font-medium transition-colors py-2',
                      isSidebarCollapsed ? 'justify-center px-0' : 'px-3 space-x-3',
                      isActive
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )
                  )
                }
                title={link.label}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {!isSidebarCollapsed && <span>{link.label}</span>}
              </NavLink>
            );
          })}
        </nav>

        {/* Local Privacy Status */}
        <div className="p-3 border-t border-border">
          {!isSidebarCollapsed ? (
            <div className="flex items-center space-x-2 text-[11px] text-muted-foreground bg-muted/40 p-2 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
              <div className="truncate">
                <span className="font-semibold block text-foreground">Local Only</span>
                <span className="text-[10px] block opacity-80">100% on device</span>
              </div>
            </div>
          ) : (
            <div className="flex justify-center" title="Local Only • 100% on device">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
            </div>
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
        {/* TOP HEADER */}
        <header className="h-14 border-b border-border bg-card/60 backdrop-blur sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6">
          <div className="flex items-center space-x-3">
            {/* Mobile Brand indicator */}
            <div className="flex md:hidden items-center space-x-2">
              <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground font-black text-xs">
                OS
              </div>
              <span className="font-bold text-sm">LifeOS</span>
            </div>

            {/* Ctrl+K Search button */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="hidden sm:flex items-center space-x-2 bg-muted/60 hover:bg-muted border border-border px-3 py-1.5 rounded-lg text-xs text-muted-foreground transition-all w-52 sm:w-64"
            >
              <Search className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Search everything...</span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-card border border-border rounded shadow-xs text-foreground">
                Ctrl K
              </kbd>
            </button>
          </div>

          <div className="flex items-center space-x-2">
            {/* Mobile search icon */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="sm:hidden p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Search"
            >
              <Search className="w-4 h-4" />
            </button>

            {/* Mobile Quick Add */}
            <button
              onClick={() => setIsQuickAddOpen(true)}
              className="md:hidden flex items-center space-x-1.5 bg-primary text-primary-foreground px-2.5 py-1.5 rounded-lg text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>

            {/* Theme Toggle Button */}
            <button
              onClick={() => {
                const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark';
                setTheme(next);
              }}
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title={`Current theme: ${theme}. Click to change.`}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? (
                <Moon className="w-4 h-4 text-sky-400" />
              ) : (
                <Sun className="w-4 h-4 text-amber-500" />
              )}
            </button>
          </div>
        </header>

        {/* PAGE CONTENT */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto animate-fade-in">
          <Outlet />
        </main>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 h-14 bg-card/95 backdrop-blur border-t border-border z-30 flex items-center justify-around px-2">
        <NavLink
          to="/"
          className={({ isActive }) =>
            twMerge(
              clsx(
                'flex flex-col items-center justify-center w-12 h-full text-[10px]',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              )
            )
          }
        >
          <LayoutDashboard className="w-4 h-4 mb-0.5" />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/agenda"
          className={({ isActive }) =>
            twMerge(
              clsx(
                'flex flex-col items-center justify-center w-12 h-full text-[10px]',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              )
            )
          }
        >
          <CalendarCheck2 className="w-4 h-4 mb-0.5" />
          <span>Agenda</span>
        </NavLink>

        {/* Central Floating Quick Add Button */}
        <button
          onClick={() => setIsQuickAddOpen(true)}
          className="w-10 h-10 rounded-full bg-primary text-primary-foreground shadow-md flex items-center justify-center -mt-4 border-2 border-background focus:outline-none"
          aria-label="Quick Add"
        >
          <Plus className="w-5 h-5" />
        </button>

        <NavLink
          to="/finance"
          className={({ isActive }) =>
            twMerge(
              clsx(
                'flex flex-col items-center justify-center w-12 h-full text-[10px]',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              )
            )
          }
        >
          <Wallet className="w-4 h-4 mb-0.5" />
          <span>Finance</span>
        </NavLink>

        <NavLink
          to="/earnings"
          className={({ isActive }) =>
            twMerge(
              clsx(
                'flex flex-col items-center justify-center w-12 h-full text-[10px]',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground'
              )
            )
          }
        >
          <Briefcase className="w-4 h-4 mb-0.5" />
          <span>Earnings</span>
        </NavLink>
      </nav>

      {/* MODALS */}
      <GlobalSearch isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />
      <QuickAddModal isOpen={isQuickAddOpen} onClose={() => setIsQuickAddOpen(false)} />
    </div>
  );
}
