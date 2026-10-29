import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  type?: 'success' | 'error' | 'info';
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

interface ToastContextType {
  toast: (options: Omit<ToastItem, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  toastWithUndo: (title: string, onUndo: () => void) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback(
    ({ duration = 4000, ...rest }: Omit<ToastItem, 'id'>) => {
      const id = Math.random().toString(36).substring(2, 9);
      const newToast: ToastItem = { id, duration, ...rest };
      setToasts(prev => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback(
    (title: string, message?: string) => {
      toast({ type: 'success', title, message });
    },
    [toast]
  );

  const error = useCallback(
    (title: string, message?: string) => {
      toast({ type: 'error', title, message });
    },
    [toast]
  );

  const toastWithUndo = useCallback(
    (title: string, onUndo: () => void) => {
      toast({
        type: 'info',
        title,
        duration: 7000, // generous time for undo
        action: {
          label: 'Undo',
          onClick: onUndo,
        },
      });
    },
    [toast]
  );

  return (
    <ToastContext.Provider value={{ toast, success, error, toastWithUndo }}>
      {children}
      <div
        aria-live="polite"
        className="fixed bottom-16 sm:bottom-6 right-4 sm:right-6 z-50 flex flex-col space-y-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map(t => {
          const icons = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />,
            error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />,
            info: <Info className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />,
          };

          return (
            <div
              key={t.id}
              className="pointer-events-auto flex items-start justify-between p-3.5 bg-card/95 backdrop-blur border border-border rounded-xl shadow-lg animate-slide-up"
            >
              <div className="flex items-start space-x-3">
                {icons[t.type || 'info']}
                <div>
                  <p className="text-xs font-semibold text-foreground">{t.title}</p>
                  {t.message && <p className="text-xs text-muted-foreground mt-0.5">{t.message}</p>}
                </div>
              </div>
              <div className="flex items-center space-x-2 shrink-0 ml-3">
                {t.action && (
                  <button
                    onClick={() => {
                      t.action?.onClick();
                      removeToast(t.id);
                    }}
                    className="px-2.5 py-1 text-xs font-semibold text-primary bg-primary/10 hover:bg-primary/20 rounded-md transition-colors"
                  >
                    {t.action.label}
                  </button>
                )}
                <button
                  onClick={() => removeToast(t.id)}
                  className="text-muted-foreground hover:text-foreground p-0.5 rounded"
                  aria-label="Dismiss toast"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}
