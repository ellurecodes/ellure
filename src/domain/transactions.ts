import { Transaction, IncomeTransaction, ExpenseTransaction } from './types';

export interface IncomeExpenseSummary {
  totalIncomePaise: number;
  totalExpensePaise: number;
  netSavingsPaise: number; // income - expense
  savingsRatePercentage: number; // (netSavings / income) * 100 or 0
}

/**
 * Computes pure income and expense totals for a list of transactions.
 * Strict rules:
 * - Only 'income' and 'earning_payout' count as income.
 * - Only 'expense' counts as expense.
 * - 'transfer', 'adjustment', and all 'loan_*' transactions are strictly EXCLUDED.
 * - Soft-deleted transactions are strictly EXCLUDED.
 */
export function calculateIncomeExpense(
  transactions: Transaction[],
  filter?: {
    startDate?: string;
    endDate?: string;
  }
): IncomeExpenseSummary {
  let totalIncomePaise = 0;
  let totalExpensePaise = 0;

  for (const tx of transactions) {
    if (tx.deletedAt) continue;

    if (filter?.startDate && tx.date < filter.startDate) continue;
    if (filter?.endDate && tx.date > filter.endDate) continue;

    if (tx.type === 'income') {
      totalIncomePaise += tx.amountPaise;
    } else if (tx.type === 'earning_payout') {
      totalIncomePaise += tx.amountPaise;
    } else if (tx.type === 'expense') {
      totalExpensePaise += tx.amountPaise;
    }
    // Transfers, adjustments, loans have NO effect on income/expense.
  }

  const netSavingsPaise = totalIncomePaise - totalExpensePaise;
  const savingsRatePercentage =
    totalIncomePaise > 0
      ? Math.max(0, Math.round((netSavingsPaise / totalIncomePaise) * 100))
      : 0;

  return {
    totalIncomePaise,
    totalExpensePaise,
    netSavingsPaise,
    savingsRatePercentage,
  };
}

/**
 * Checks if a candidate transaction is a duplicate of an existing transaction.
 * Soft match criterion: identical amount + date + accountId + title.
 */
export function checkDuplicateTransaction(
  candidate: {
    amountPaise: number;
    date: string;
    accountId?: string;
    title: string;
    excludeId?: string;
  },
  existingTransactions: Transaction[]
): { isDuplicate: boolean; matchedTransaction?: Transaction } {
  const normTitle = candidate.title.trim().toLowerCase();

  for (const tx of existingTransactions) {
    if (tx.deletedAt) continue;
    if (candidate.excludeId && tx.id === candidate.excludeId) continue;

    // Check account match if applicable
    let txAccountId: string | undefined;
    let txAmount = 0;

    if ('accountId' in tx) {
      txAccountId = tx.accountId;
    } else if (tx.type === 'transfer') {
      txAccountId = tx.fromAccountId;
    }

    if (tx.type === 'transfer') {
      txAmount = tx.amountPaise;
    } else if (tx.type === 'adjustment') {
      txAmount = Math.abs(tx.deltaPaise);
    } else {
      txAmount = tx.amountPaise;
    }

    if (
      tx.date === candidate.date &&
      txAmount === candidate.amountPaise &&
      (!candidate.accountId || txAccountId === candidate.accountId) &&
      tx.title.trim().toLowerCase() === normTitle
    ) {
      return { isDuplicate: true, matchedTransaction: tx };
    }
  }

  return { isDuplicate: false };
}

/**
 * Groups expense transactions by category.
 */
export function groupExpensesByCategory(
  transactions: Transaction[],
  filter?: { startDate?: string; endDate?: string }
): { category: string; amountPaise: number; count: number; percentage: number }[] {
  const totals: Record<string, { amountPaise: number; count: number }> = {};
  let totalExpense = 0;

  for (const tx of transactions) {
    if (tx.deletedAt) continue;
    if (filter?.startDate && tx.date < filter.startDate) continue;
    if (filter?.endDate && tx.date > filter.endDate) continue;

    if (tx.type === 'expense') {
      totalExpense += tx.amountPaise;
      if (!totals[tx.category]) {
        totals[tx.category] = { amountPaise: 0, count: 0 };
      }
      totals[tx.category].amountPaise += tx.amountPaise;
      totals[tx.category].count += 1;
    }
  }

  return Object.entries(totals)
    .map(([category, data]) => ({
      category,
      amountPaise: data.amountPaise,
      count: data.count,
      percentage: totalExpense > 0 ? Math.round((data.amountPaise / totalExpense) * 100) : 0,
    }))
    .sort((a, b) => b.amountPaise - a.amountPaise);
}
