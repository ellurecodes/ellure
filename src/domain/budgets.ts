import { Budget, Transaction } from './types';

export interface BudgetStatus {
  category: string; // 'total' or specific category
  budgetPaise: number;
  actualSpentPaise: number;
  remainingPaise: number;
  percentageUsed: number;
  isOverBudget: boolean;
  isNearLimit: boolean; // >= 80%
}

export function evaluateBudgets(
  budgets: Budget[],
  transactions: Transaction[],
  monthStr: string // YYYY-MM
): {
  overallStatus: BudgetStatus | null;
  categoryStatuses: BudgetStatus[];
} {
  const monthPrefix = monthStr;
  const expensesByCategory: Record<string, number> = {};
  let totalExpensePaise = 0;

  for (const tx of transactions) {
    if (tx.deletedAt) continue;
    if (tx.type === 'expense' && tx.date.startsWith(monthPrefix)) {
      totalExpensePaise += tx.amountPaise;
      expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + tx.amountPaise;
    }
  }

  let overallStatus: BudgetStatus | null = null;
  const categoryStatuses: BudgetStatus[] = [];

  for (const b of budgets) {
    if (b.month !== monthStr) continue;

    const actual =
      b.category === 'total'
        ? totalExpensePaise
        : (expensesByCategory[b.category] || 0);

    const percentageUsed = b.amountPaise > 0 ? Math.round((actual / b.amountPaise) * 100) : 0;
    const remainingPaise = b.amountPaise - actual;

    const status: BudgetStatus = {
      category: b.category,
      budgetPaise: b.amountPaise,
      actualSpentPaise: actual,
      remainingPaise,
      percentageUsed,
      isOverBudget: actual >= b.amountPaise,
      isNearLimit: percentageUsed >= 80 && actual < b.amountPaise,
    };

    if (b.category === 'total') {
      overallStatus = status;
    } else {
      categoryStatuses.push(status);
    }
  }

  // Sort categories by highest percentage used
  categoryStatuses.sort((a, b) => b.percentageUsed - a.percentageUsed);

  return { overallStatus, categoryStatuses };
}

/**
 * Calculates student monthly allowance metrics and safe daily spending.
 */
export function calculateAllowanceMetrics(
  monthlyAllowancePaise: number,
  currentSpendablePaise: number,
  today: Date = new Date(),
  resetDay: number = 1
): {
  daysRemaining: number;
  safeDailySpendPaise: number;
  cycleProgressPercent: number;
} {
  const currentYear = today.getFullYear();
  const currentMonth = today.getMonth(); // 0-11
  const currentDate = today.getDate();

  // Determine end date of current cycle
  let cycleEnd: Date;
  if (currentDate >= resetDay) {
    // Cycle ends in next month on resetDay
    cycleEnd = new Date(currentYear, currentMonth + 1, resetDay);
  } else {
    // Cycle ends this month on resetDay
    cycleEnd = new Date(currentYear, currentMonth, resetDay);
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const daysRemaining = Math.max(1, Math.ceil((cycleEnd.getTime() - today.getTime()) / msPerDay));

  // Cycle length in days
  const cycleStart = new Date(cycleEnd);
  cycleStart.setMonth(cycleStart.getMonth() - 1);
  const totalCycleDays = Math.max(28, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / msPerDay));
  const daysPassed = Math.max(0, totalCycleDays - daysRemaining);
  const cycleProgressPercent = Math.min(100, Math.round((daysPassed / totalCycleDays) * 100));

  // Safe daily spend is spendable money divided by days remaining
  const safeDailySpendPaise = currentSpendablePaise > 0
    ? Math.floor(currentSpendablePaise / daysRemaining)
    : 0;

  return {
    daysRemaining,
    safeDailySpendPaise,
    cycleProgressPercent,
  };
}

/**
 * Computes runway and financial health.
 * If data spans fewer than 30 days, returns hasEnoughData: false.
 */
export function calculateFinancialHealth(
  transactions: Transaction[],
  spendableBalancePaise: number
): {
  hasEnoughData: boolean;
  averageDailyExpensePaise: number;
  runwayDays: number | null;
  adherenceScore: number; // 0-100
} {
  const validExpenses = transactions.filter((t): t is Transaction & { amountPaise: number } => !t.deletedAt && t.type === 'expense');
  if (validExpenses.length === 0) {
    return { hasEnoughData: false, averageDailyExpensePaise: 0, runwayDays: null, adherenceScore: 100 };
  }

  const dates = validExpenses.map(t => t.date).sort();
  const earliest = new Date(dates[0]);
  const latest = new Date(dates[dates.length - 1]);
  const daysSpan = Math.max(1, Math.round((latest.getTime() - earliest.getTime()) / (1000 * 3600 * 24)));

  if (daysSpan < 30) {
    return {
      hasEnoughData: false,
      averageDailyExpensePaise: 0,
      runwayDays: null,
      adherenceScore: 100,
    };
  }

  const totalExpense = validExpenses.reduce((sum, t) => sum + t.amountPaise, 0);
  const averageDailyExpensePaise = Math.round(totalExpense / daysSpan);
  const runwayDays = averageDailyExpensePaise > 0
    ? Math.floor(spendableBalancePaise / averageDailyExpensePaise)
    : 999;

  return {
    hasEnoughData: true,
    averageDailyExpensePaise,
    runwayDays,
    adherenceScore: Math.min(100, Math.max(0, 100 - (runwayDays < 15 ? 40 : runwayDays < 30 ? 20 : 0))),
  };
}
