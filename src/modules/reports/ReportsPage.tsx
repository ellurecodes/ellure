import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { calculateIncomeExpense, groupExpensesByCategory } from '../../domain/transactions';
import { calculateEarningsSummary } from '../../domain/earnings';
import { calculateFinancialHealth } from '../../domain/budgets';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { MoneyDisplay } from '../../components/shared/MoneyDisplay';
import { Printer, Calendar, FileSpreadsheet } from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';
import { useUserData } from '../../hooks/useUserData';

export function ReportsPage() {
  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);

  const {
    currentUser,
    transactions,
    earningRecords,
    withdrawals,
    platforms,
    academicTasks,
    goals,
    habits,
    habitLogs,
  } = useUserData();

  // Month bounds
  const startDate = `${selectedMonth}-01`;
  const endDate = `${selectedMonth}-31`;

  // Filtered calculations for chosen month
  const cashFlow = useMemo(() => {
    return calculateIncomeExpense(transactions, { startDate, endDate });
  }, [transactions, startDate, endDate]);

  const categoryExpenses = useMemo(() => {
    return groupExpensesByCategory(transactions, { startDate, endDate });
  }, [transactions, startDate, endDate]);

  const payoutTransactions = useMemo(() => {
    return transactions.filter(
      t => t.type === 'earning_payout' && t.date >= startDate && t.date <= endDate
    ) as any;
  }, [transactions, startDate, endDate]);

  const monthEarnings = useMemo(() => {
    const monthRecords = earningRecords.filter(r => r.date >= startDate && r.date <= endDate);
    return calculateEarningsSummary(monthRecords, withdrawals, payoutTransactions, platforms);
  }, [earningRecords, withdrawals, payoutTransactions, platforms, startDate, endDate]);

  const financialHealth = useMemo(() => {
    return calculateFinancialHealth(transactions, cashFlow.netSavingsPaise);
  }, [transactions, cashFlow]);

  // Academic submissions completed this month
  const completedAcademicTasks = useMemo(() => {
    return academicTasks.filter(
      t => !t.deletedAt && t.status === 'done' && t.dueDate >= startDate && t.dueDate <= endDate
    ).length;
  }, [academicTasks, startDate, endDate]);

  const unfinishedAcademicTasks = useMemo(() => {
    return academicTasks.filter(
      t => !t.deletedAt && t.status !== 'done' && t.dueDate >= startDate && t.dueDate <= endDate
    ).length;
  }, [academicTasks, startDate, endDate]);

  return (
    <div className="space-y-6">
      {/* Top Header & Print Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4 print:hidden">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Monthly Financial & Academic Report</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Audit-grade performance review generated strictly from local records
          </p>
        </div>

        <div className="flex items-center space-x-3">
          <Input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            className="w-40 h-9 text-xs"
          />
          <Button size="sm" onClick={() => window.print()}>
            <Printer className="w-3.5 h-3.5 mr-1.5" />
            Print / Export PDF
          </Button>
        </div>
      </div>

      {/* Printable Report Document */}
      <div className="space-y-6 bg-card border border-border p-6 rounded-xl shadow-xs print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex justify-between items-start border-b border-border pb-4">
          <div>
            <h2 className="text-lg font-bold text-foreground">LifeOS Monthly Statement: {selectedMonth}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Strict Local-First Personal Command Center • Student Performance Review
            </p>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            Generated: {todayStr}
          </Badge>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="p-3 bg-muted/40 rounded-lg">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total Income</span>
            <div className="text-base font-bold text-income mt-0.5">
              <MoneyDisplay paise={cashFlow.totalIncomePaise} showSign />
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Total Spending</span>
            <div className="text-base font-bold text-expense mt-0.5">
              <MoneyDisplay paise={-cashFlow.totalExpensePaise} showSign />
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Net Savings</span>
            <div className="text-base font-bold text-foreground mt-0.5">
              <MoneyDisplay paise={cashFlow.netSavingsPaise} colorScheme="auto" showSign />
            </div>
          </div>

          <div className="p-3 bg-muted/40 rounded-lg">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase">Savings Rate</span>
            <div className="text-base font-bold text-foreground mt-0.5">
              {cashFlow.totalIncomePaise > 0 ? `${cashFlow.savingsRatePercentage}%` : 'Not enough data yet'}
            </div>
          </div>
        </div>

        {/* Financial Health & Runway Summary (Requirement 6) */}
        <div className="p-3.5 bg-muted/20 border border-border rounded-lg text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground uppercase text-[10px] tracking-wider">
              Financial Health & Spending Runway
            </span>
            <Badge variant="outline" className="text-[10px]">
              {financialHealth.hasEnoughData ? 'Calculated' : 'Insufficient Data'}
            </Badge>
          </div>
          {financialHealth.hasEnoughData ? (
            <p className="text-muted-foreground">
              Average daily expense: ₹{(financialHealth.averageDailyExpensePaise / 100).toFixed(0)} • Estimated runway: {financialHealth.runwayDays} days.
            </p>
          ) : (
            <p className="text-muted-foreground italic">
              Not enough data yet — requires at least 30 days of active expense tracking to compute reliable daily averages and runway projections.
            </p>
          )}
        </div>

        {/* Earnings Breakdown */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Online Earnings & Platform Payouts
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-muted/20 p-3.5 rounded-lg border border-border">
            <div>
              <span className="text-muted-foreground block text-[11px]">Payouts Received (Ledger Income)</span>
              <span className="font-bold text-income text-sm">
                <MoneyDisplay paise={monthEarnings.verifiedReceivedPaise} />
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Verified Pending</span>
              <span className="font-bold text-sm">
                <MoneyDisplay paise={monthEarnings.verifiedPendingPaise} />
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block text-[11px]">Uncertain Earnings (Isolated)</span>
              <span className="font-bold text-amber-500 text-sm">
                <MoneyDisplay paise={monthEarnings.uncertainPaise} />
              </span>
            </div>
          </div>
        </div>

        {/* Spending by Category Table */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
            Category Spending Summary
          </h3>
          {categoryExpenses.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No expense records for this month.</p>
          ) : (
            <div className="border border-border rounded-lg overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground text-[10px] uppercase">
                  <tr>
                    <th className="py-2 px-3">Category</th>
                    <th className="py-2 px-3">Count</th>
                    <th className="py-2 px-3 text-right">Total Spent</th>
                    <th className="py-2 px-3 text-right">Share</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {categoryExpenses.map(c => (
                    <tr key={c.category}>
                      <td className="py-2 px-3 font-medium">{c.category}</td>
                      <td className="py-2 px-3 text-muted-foreground tabular-nums">{c.count}</td>
                      <td className="py-2 px-3 text-right font-semibold tabular-nums">
                        ₹{(c.amountPaise / 100).toFixed(2)}
                      </td>
                      <td className="py-2 px-3 text-right text-muted-foreground tabular-nums">
                        {c.percentage}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Academic & Habit Performance */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          <div className="p-3.5 border border-border rounded-lg space-y-2">
            <h4 className="text-xs font-semibold text-foreground uppercase">Academic Submissions</h4>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Completed Tasks:</span>
              <span className="font-bold text-emerald-600">{completedAcademicTasks}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Unfinished / In Progress:</span>
              <span className="font-bold text-amber-600">{unfinishedAcademicTasks}</span>
            </div>
          </div>

          <div className="p-3.5 border border-border rounded-lg space-y-2">
            <h4 className="text-xs font-semibold text-foreground uppercase">Goals & Active Milestones</h4>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total Active Goals:</span>
              <span className="font-bold">{goals.filter(g => !g.deletedAt).length}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Active Daily Habits:</span>
              <span className="font-bold">{habits.length}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
