import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './modules/dashboard/DashboardPage';
import { FinancePage } from './modules/finance/FinancePage';
import { EarningsPage } from './modules/earnings/EarningsPage';
import { AcademicsPage } from './modules/academics/AcademicsPage';
import { HabitsPage } from './modules/habits/HabitsPage';
import { GoalsPage } from './modules/goals/GoalsPage';
import { AgendaPage } from './modules/agenda/AgendaPage';
import { ReportsPage } from './modules/reports/ReportsPage';
import { SettingsPage } from './modules/settings/SettingsPage';
import { TrashPage } from './modules/trash/TrashPage';
import { initializeDatabaseDefaults } from './db/seed';
import { db } from './db/db';
import { generateDueRecurringTransactions } from './domain/recurring';

export default function App() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    async function init() {
      // 1. Initialize default accounts and system settings
      await initializeDatabaseDefaults();

      // 2. Check and generate due recurring transactions idempotently
      try {
        const schedules = await db.recurringTransactions.toArray();
        const existingTx = await db.transactions.toArray();
        const todayStr = new Date().toISOString().slice(0, 10);

        const { newTransactions, updatedSchedules } = generateDueRecurringTransactions(
          schedules,
          existingTx,
          todayStr
        );

        if (newTransactions.length > 0) {
          await db.transaction('rw', [db.transactions, db.recurringTransactions], async () => {
            await db.transactions.bulkAdd(newTransactions);
            for (const sch of updatedSchedules) {
              await db.recurringTransactions.put(sch);
            }
          });
        }
      } catch (err) {
        console.error('Failed to run recurring transactions check:', err);
      }

      setIsInitialized(true);
    }

    init();
  }, []);

  if (!isInitialized) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md animate-pulse">
          OS
        </div>
        <p className="text-xs text-muted-foreground mt-3 font-medium">Starting LifeOS Command Center...</p>
      </div>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<AppLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="finance" element={<FinancePage />} />
            <Route path="earnings" element={<EarningsPage />} />
            <Route path="academics" element={<AcademicsPage />} />
            <Route path="habits" element={<HabitsPage />} />
            <Route path="goals" element={<GoalsPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="trash" element={<TrashPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
