import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ShieldCheck, LogOut, Sun, Moon } from 'lucide-react';

export function AdminPortalLayout({ children }: { children: React.ReactNode }) {
  const { currentUser, logout } = useAuth();
  const [theme, setTheme] = React.useState<'light' | 'dark'>(() => {
    return (localStorage.getItem('lifeos_theme') as any) === 'dark' ? 'dark' : 'light';
  });

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('lifeos_theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('lifeos_theme', 'light');
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased">
      {/* Top Admin Bar */}
      <header className="h-16 border-b border-border bg-card px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-black text-xs shadow-sm">
            OS
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm tracking-tight text-foreground">LifeOS Admin Portal</span>
              <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                Superuser
              </Badge>
            </div>
            <span className="text-[11px] text-muted-foreground block -mt-0.5">
              Access Control & User Approval System
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {/* Privacy isolation badge */}
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Privacy Guard Active</span>
          </div>

          {/* Current Admin Info */}
          <div className="hidden sm:block text-right">
            <span className="text-xs font-semibold text-foreground block">{currentUser?.displayName}</span>
            <span className="text-[10px] text-muted-foreground font-mono block">@{currentUser?.username}</span>
          </div>

          {/* Theme switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
          </button>

          {/* Logout button */}
          <Button
            variant="outline"
            size="sm"
            onClick={logout}
            className="text-xs h-8 px-3 text-destructive hover:bg-destructive/10 border-destructive/20"
          >
            <LogOut className="w-3.5 h-3.5 mr-1.5" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 animate-fade-in">
        {children}
      </main>

      {/* Admin Footer */}
      <footer className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        LifeOS Local-First Architecture • Strict Zero-Knowledge Privacy Isolation
      </footer>
    </div>
  );
}
