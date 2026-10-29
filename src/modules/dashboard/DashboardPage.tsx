import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import {
  calculateDashboardBalances,
  deriveAllAccountBalances,
} from '../../domain/balances';
import { calculateIncomeExpense } from '../../domain/transactions';
import { calculateEarningsSummary } from '../../domain/earnings';
import { evaluateBudgets, calculateAllowanceMetrics } from '../../domain/budgets';
import { calculateHabitStreak } from '../../domain/habits';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { MoneyDisplay } from '../../components/shared/MoneyDisplay';
import { Link } from 'react-router-dom';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Briefcase,
  BookOpen,
  Flame,
  Target,
  Clock,
  Sparkles,
  ChevronRight,
  PiggyBank,
  CheckCircle2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useUserData } from '../../hooks/useUserData';

export function DashboardPage() {
  const {
    currentUser,
    accounts,
    transactions,
    platforms,
    earningRecords,
    withdrawals,
    academicTasks,
    habits,
    habitLogs,
    goals,
    budgets,
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

  const budgetEval = useMemo(() => {
    return evaluateBudgets(budgets, transactions, currentMonthStr);
  }, [budgets, transactions, currentMonthStr]);

  const allowance = useMemo(() => {
    return calculateAllowanceMetrics(
      settings?.monthlyAllowancePaise || 800000,
      dashboardBalances.totalSpendablePaise,
      new Date(),
      settings?.allowanceResetDay || 1
    );
  }, [settings, dashboardBalances]);

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
  const cashFlowChartData = [
    { name: 'Income', amount: monthCashFlow.totalIncomePaise / 100 },
    { name: 'Expense', amount: monthCashFlow.totalExpensePaise / 100 },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Welcome back, {settings?.studentName || 'Student'}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Student Command Dashboard • {allowance.daysRemaining} days left in cycle • Safe daily spend: ₹{(allowance.safeDailySpendPaise / 100).toFixed(0)}
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

      {/* Hero Financial Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4 bg-card">
          <div className="flex items-center justify-between text-muted-foreground mb-1">
            <span className="text-[11px] font-semibold uppercase">Total Spendable Money</span>
            <Wallet className="w-4 h-4 text-primary" />
          </div>
          <div className="text-xl font-bold text-foreground">
            <MoneyDisplay paise={dashboardBalances.totalSpendablePaise} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Sum of spendable cash & digital accounts</p>
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
        {/* Cash Flow vs Budget */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-sm">Month Cash Flow & Budget</CardTitle>
                <CardDescription>Income vs spending comparison</CardDescription>
              </div>
              <Link to="/finance" className="text-xs text-primary hover:underline">
                View Ledger →
              </Link>
            </div>
          </CardHeader>
          <CardContent className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={cashFlowChartData}>
                <XAxis dataKey="name" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={(v: any) => [`₹${v.toFixed(2)}`, 'Amount']} />
                <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
                  {habitCompletedCount} / {habits.length}
                </span>
              </div>
            </div>

            {/* Incomplete tasks snippet */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-muted-foreground uppercase">Submissions</span>
              {todayTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No submissions due today.</p>
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
            <p className="text-xs text-muted-foreground py-4 text-center">No transactions recorded yet.</p>
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
