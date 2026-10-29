import React, { useState, useEffect, useMemo } from 'react';
import { Search, ArrowRight, DollarSign, Briefcase, BookOpen, Target, Calendar, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { formatInr } from '../../domain/money';

export interface GlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
}

export function GlobalSearch({ isOpen, onClose }: GlobalSearchProps) {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  // Listen to Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const platforms = useLiveQuery(() => db.platforms.toArray()) || [];
  const tasks = useLiveQuery(() => db.academicTasks.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const matches: {
      id: string;
      title: string;
      subtitle: string;
      category: 'Transactions' | 'Platforms' | 'Academic Tasks' | 'Goals';
      url: string;
      icon: any;
    }[] = [];

    // Search transactions
    for (const tx of transactions) {
      if (tx.deletedAt) continue;
      if (
        tx.title.toLowerCase().includes(q) ||
        ('category' in tx && tx.category.toLowerCase().includes(q)) ||
        (tx.notes && tx.notes.toLowerCase().includes(q))
      ) {
        const amt = 'amountPaise' in tx ? formatInr(tx.amountPaise) : '';
        matches.push({
          id: `tx_${tx.id}`,
          title: tx.title,
          subtitle: `${tx.date} • ${amt} • ${tx.type}`,
          category: 'Transactions',
          url: '/finance',
          icon: DollarSign,
        });
        if (matches.length > 20) break;
      }
    }

    // Search platforms
    for (const p of platforms) {
      if (p.deletedAt) continue;
      if (p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)) {
        matches.push({
          id: `plat_${p.id}`,
          title: p.name,
          subtitle: `${p.category} • Trust: ${p.trustStatus}`,
          category: 'Platforms',
          url: '/earnings',
          icon: Briefcase,
        });
      }
    }

    // Search tasks
    for (const t of tasks) {
      if (t.deletedAt) continue;
      if (t.title.toLowerCase().includes(q) || t.type.toLowerCase().includes(q)) {
        matches.push({
          id: `task_${t.id}`,
          title: t.title,
          subtitle: `Due: ${t.dueDate} • Status: ${t.status}`,
          category: 'Academic Tasks',
          url: '/academics',
          icon: BookOpen,
        });
      }
    }

    // Search goals
    for (const g of goals) {
      if (g.deletedAt) continue;
      if (g.title.toLowerCase().includes(q) || g.category.toLowerCase().includes(q)) {
        matches.push({
          id: `goal_${g.id}`,
          title: g.title,
          subtitle: `${g.category} • ${g.progressPercent}% complete`,
          category: 'Goals',
          url: '/goals',
          icon: Target,
        });
      }
    }

    return matches.slice(0, 15);
  }, [query, transactions, platforms, tasks, goals]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-card rounded-xl border border-border shadow-2xl overflow-hidden flex flex-col">
        <div className="flex items-center px-4 py-3 border-b border-border">
          <Search className="w-4 h-4 text-muted-foreground mr-2.5 shrink-0" />
          <input
            autoFocus
            type="text"
            placeholder="Search transactions, platforms, tasks, goals... (Esc to exit)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            className="w-full bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded"
            aria-label="Close search"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {query.trim() === '' ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              Type keywords to search across your local LifeOS database.
            </div>
          ) : results.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">
              No matching records found for "{query}".
            </div>
          ) : (
            <div className="space-y-1">
              {results.map(r => {
                const Icon = r.icon;
                return (
                  <button
                    key={r.id}
                    onClick={() => {
                      navigate(r.url);
                      onClose();
                    }}
                    className="w-full flex items-center justify-between p-2.5 rounded-lg hover:bg-muted text-left transition-colors group"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="p-1.5 rounded-md bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">{r.title}</p>
                        <p className="text-[11px] text-muted-foreground">{r.subtitle}</p>
                      </div>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
