import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ToastProvider } from './components/ui/Toast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthPage } from './modules/auth/AuthPage';
import { AdminPortalPage } from './modules/admin/AdminPortalPage';
import { AdminPortalLayout } from './modules/admin/AdminPortalLayout';
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
import { db } from './db/db';
import { generateDueRecurringTransactions } from './domain/recurring';

function AppContent() {
  const { currentUser, isLoading } = useAuth();

  useEffect(() => {
    async function checkRecurring() {
      if (!currentUser || currentUser.role === 'admin') return;
      try {
        const schedules = await db.recurringTransactions.where('userId').equals(currentUser.id).toArray();
        const existingTx = await db.transactions.where('userId').equals(currentUser.id).toArray();
        const todayStr = new Date().toISOString().slice(0, 10);

        const { newTransactions, updatedSchedules } = generateDueRecurringTransactions(
          schedules,
          existingTx,
          todayStr
        );

        if (newTransactions.length > 0) {
          const userNewTx = newTransactions.map(t => ({ ...t, userId: currentUser.id }));
          await db.transaction('rw', [db.transactions, db.recurringTransactions], async () => {
            await db.transactions.bulkAdd(userNewTx);
            for (const sch of updatedSchedules) {
              await db.recurringTransactions.put(sch);
            }
          });
        }
      } catch (err) {
        console.error('Failed to run recurring transactions check:', err);
      }
    }

    checkRecurring();
  }, [currentUser]);

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-background text-foreground">
        <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md animate-pulse">
          OS
        </div>
        <p className="text-xs text-muted-foreground mt-3 font-medium">Starting LifeOS Command Center...</p>
      </div>
    );
  }

  // Not logged in -> Show Login & Registration page
  if (!currentUser) {
    return <AuthPage />;
  }

  // Admin role: Can ONLY manage user logins (Accept, Reject, Delete). Admin cannot view user personal data.
  if (currentUser.role === 'admin') {
    return (
      <BrowserRouter>
        <AdminPortalLayout>
          <Routes>
            <Route path="/admin" element={<AdminPortalPage />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </AdminPortalLayout>
      </BrowserRouter>
    );
  }

  // Approved Student User role: Full personal productivity command center scoped to their user ID
  return (
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
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ToastProvider>
  );
}
