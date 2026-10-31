import React, { useMemo } from 'react';
import { db } from '../../db/db';
import {
  calculateDashboardBalances,
} from '../../domain/balances';
import { calculateIncomeExpense } from '../../domain/transactions';
import { calculateEarningsSummary } from '../../domain/earnings';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { MoneyDisplay } from '../../components/shared/MoneyDisplay';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowDownLeft,
  Briefcase,
  BookOpen,
  Sparkles,
  ChevronRight,
  CheckCircle2,
  Circle,
  X,
  Compass,
  Plus,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useUserData } from '../../hooks/useUserData';

export function DashboardPage() {
  const {
    accounts,
    transactions,
    platforms,
    earningRecords,
    withdrawals,
    subjects,
    academicTasks,
    habits,
    habitLogs,
    goals,
    settings,
  } = useUserData();

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  // Derived Values
  const dashboardBalances = useMemo(() => calculateDashboardBalances(accounts, transactions), [accounts, transactions]);
  const monthCashFlow = useMemo(() => {
    return calculateIncomeExpense(transactions, {
      startDate: `${currentMonthStr}-01`,
      endDate: `${currentMonthStr}-31`,
    });
  }, [transactions, currentMonthStr]);

  const payoutTransactions = useMemo(() => {
    return transactions.filter(t => t.type === 'earning_payout') as any;
  }, [transactions]);

  const earningsSummary = useMemo(() => {
    return calculateEarningsSummary(earningRecords, withdrawals, payoutTransactions, platforms);
  }, [earningRecords, withdrawals, payoutTransactions, platforms]);

  // Tasks due today
  const todayTasks = useMemo(() => {
    return academicTasks.filter(t => !t.deletedAt && t.dueDate === todayStr);
  }, [academicTasks, todayStr]);

  // Habit completion status
  const habitCompletedCount = useMemo(() => {
    return habits.filter(h =>
      habitLogs.some(l => l.habitId === h.id && l.date === todayStr && l.completed)
    ).length;
  }, [habits, habitLogs, todayStr]);

  // Recent 5 transactions
  const recentTransactions = useMemo(() => {
    return transactions
      .filter(t => !t.deletedAt)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
  }, [transactions]);

  // Cash Flow Bar Chart Data
  const hasCashFlowData = monthCashFlow.totalIncomePaise > 0 || monthCashFlow.totalExpensePaise > 0;
  const cashFlowChartData = [
    { name: 'Income', amount: monthCashFlow.totalIncomePaise / 100 },
    { name: 'Expense', amount: monthCashFlow.totalExpensePaise / 100 },
  ];

  // Getting Started Onboarding Checklist Items (ticked off automatically from real data)
  const checklistItems = [
    {
      id: 'acc',
      label: 'Add your first account (Cash or UPI)',
      completed: accounts.filter(a => !a.deletedAt).length > 0,
      link: '/finance',
      actionText: 'Add Account',
    },
    {
      id: 'tx',
      label: 'Record your first transaction',
      completed: transactions.filter(t => !t.deletedAt).length > 0,
      link: '/finance',
      actionText: 'Add Transaction',
    },
    {
      id: 'plat',
      label: 'Add an earning platform (Freelance, gigs, etc.)',
      completed: platforms.filter(p => !p.deletedAt).length > 0,
      link: '/earnings',
      actionText: 'Add Platform',
    },
    {
      id: 'acad',
      label: 'Add a semester course or academic task',
      completed: subjects.filter(s => !s.isArchived).length > 0 || academicTasks.filter(t => !t.deletedAt).length > 0,
      link: '/academics',
      actionText: 'Add Course',
    },
    {
      id: 'goal',
      label: 'Create a student goal or milestone',
      completed: goals.filter(g => !g.deletedAt).length > 0,
      link: '/goals',
      actionText: 'Create Goal',
    },
  ];

  const completedChecklistCount = checklistItems.filter(i => i.completed).length;
  const showOnboarding = settings?.showOnboardingChecklist !== false;

  const handleDismissOnboarding = async () => {
    if (settings) {
      await db.settings.update(settings.id, { showOnboardingChecklist: false });
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Welcome, {settings?.studentName || 'Student'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Student Command Dashboard • Local-first, private personal command center
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Link to="/agenda">
            <Button size="sm" variant="outline">
              Open Agenda
              <ChevronRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Getting Started Onboarding Checklist (Requirement 7) */}
      {showOnboarding && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Compass className="w-4 h-4 text-primary" />
                <CardTitle className="text-sm font-semibold text-foreground">
                  Getting Started with LifeOS
                </CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {completedChecklistCount} of {checklistItems.length} completed
                </Badge>
              </div>
              <button
                onClick={handleDismissOnboarding}
                className="text-muted-foreground hover:text-foreground text-xs flex items-center space-x-1 p-1 rounded-md transition-colors"
                title="Hide checklist (can be re-enabled anytime in Settings)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <CardDescription className="text-xs">
              Follow these simple steps to set up your personal productivity and finance command center. Everything ticks off automatically from your real data.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {checklistItems.map(item => (
                <div
                  key={item.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-colors ${
                    item.completed
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-muted-foreground'
                      : 'bg-card border-border text-foreground hover:border-primary/40'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    {item.completed ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                    <span className={item.completed ? 'line-through text-muted-foreground' : 'font-medium'}>
                      {item.label}
                    </span>
                  </div>
                  {!item.completed && (
                    <Link to={item.link}>
                      <Button size="sm" variant="ghost" className="h-6 px-2 text-[11px] text-primary hover:text-primary">
                        {item.actionText} →
                      </Button>
                    </Link>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Hero Financial Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-semibold uppercase">Total Spendable Money</span>
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">
            <MoneyDisplay paise={dashboardBalances.totalSpendablePaise} showPaise="always" />
          </div>
          {accounts.filter(a => !a.deletedAt).length === 0 ? (
            <Link to="/finance" className="text-[11px] text-primary hover:underline font-medium block mt-1">
              Add your first account to get started →
            </Link>
          ) : (
            <p className="text-[10px] text-muted-foreground mt-1">Sum of spendable cash & digital accounts</p>
          )}
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-semibold uppercase">This Month Spending</span>
            <ArrowDownLeft className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-bold text-foreground">
            <MoneyDisplay paise={monthCashFlow.totalExpensePaise} colorScheme="expense" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Strict ledger expenses</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-semibold uppercase">Verified Received Earnings</span>
            <Briefcase className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-bold text-foreground">
            <MoneyDisplay paise={earningsSummary.verifiedReceivedPaise} colorScheme="income" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Paid into account via platform payouts</p>
        </Card>

        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-semibold uppercase">Uncertain Earnings</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-bold text-foreground">
            <MoneyDisplay paise={earningsSummary.uncertainPaise} colorScheme="uncertain" />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Pending review; excluded from balances</p>
        </Card>
      </div>

      {/* Grid: Cash Flow Chart & Today's Agenda Glance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cash Flow */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-sm">Month Cash Flow</CardTitle>
                <CardDescription>Income vs spending comparison</CardDescription>
              </div>
              <Link to="/finance" className="text-xs text-primary hover:underline">
                View Ledger →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="h-56">
            {!hasCashFlowData ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-2">
                <p className="text-xs text-muted-foreground font-medium">No cash flow recorded this month yet.</p>
                <p className="text-[11px] text-muted-foreground max-w-sm">
                  Add your first income or expense transaction to see the monthly cash flow comparison.
                </p>
                <Link to="/finance">
                  <Button size="sm" variant="outline" className="text-xs mt-1">
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Record First Transaction
                  </Button>
                </Link>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={cashFlowChartData}>
                  <XAxis dataKey="name" fontSize={11} />
                  <YAxis fontSize={11} tickFormatter={v => `₹${v}`} />
                  <Tooltip formatter={(v: any) => [`₹${v.toFixed(2)}`, 'Amount']} />
                  <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Quick Agenda & Habit Snapshot */}
        <Card className="flex flex-col">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-sm">Today's Focus</CardTitle>
              <Link to="/agenda" className="text-xs text-primary hover:underline">
                Full Agenda →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="p-3 bg-muted/40 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Academic Tasks Due</span>
                <span className="font-bold tabular-nums">{todayTasks.length}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Habits Completed Today</span>
                <span className="font-bold tabular-nums">
                  {habits.length === 0 ? '0 (No habits)' : `${habitCompletedCount} / ${habits.length}`}
                </span>
              </div>
            </div>

            {/* Incomplete tasks snippet */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Submissions</span>
              {todayTasks.length === 0 ? (
                <div className="py-2 text-center">
                  <p className="text-xs text-muted-foreground italic">No submissions due today.</p>
                  <Link to="/academics" className="text-[11px] text-primary hover:underline block mt-1">
                    Manage course tasks →
                  </Link>
                </div>
              ) : (
                todayTasks.slice(0, 3).map(t => (
                  <div key={t.id} className="text-xs flex items-center justify-between p-1.5 rounded-lg bg-card border border-border">
                    <span className="truncate max-w-[150px]">{t.title}</span>
                    <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity Table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Recent Ledger Activity</CardTitle>
            <Link to="/finance" className="text-xs text-primary hover:underline">
              See all transactions →
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {recentTransactions.length === 0 ? (
            <div className="py-6 text-center space-y-1">
              <p className="text-xs text-muted-foreground font-medium">No transactions recorded yet.</p>
              <p className="text-[11px] text-muted-foreground">
                Your recent income, expenses, and transfers will be listed here.
              </p>
              <Link to="/finance" className="inline-block mt-2">
                <Button size="sm" variant="outline" className="text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Add First Transaction
                </Button>
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentTransactions.map(tx => (
                <div key={tx.id} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium text-foreground block">{tx.title}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {tx.date} • {'category' in tx ? tx.category : tx.type}
                    </span>
                  </div>
                  <div className="text-right">
                    {tx.type === 'income' || tx.type === 'earning_payout' ? (
                      <MoneyDisplay paise={tx.amountPaise} showSign colorScheme="income" />
                    ) : tx.type === 'expense' ? (
                      <MoneyDisplay paise={-tx.amountPaise} showSign colorScheme="expense" />
                    ) : (
                      <MoneyDisplay paise={'amountPaise' in tx ? tx.amountPaise : 0} colorScheme="neutral" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
