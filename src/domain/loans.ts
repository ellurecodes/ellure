import { LoanTransaction } from './types';

export interface PersonLoanSummary {
  personName: string;
  totalLentPaise: number;
  repaidToUsPaise: number;
  outstandingReceivablePaise: number; // money they owe us
  totalBorrowedPaise: number;
  repaidByUsPaise: number;
  outstandingPayablePaise: number; // money we owe them
  isOverdue: boolean;
  earliestOverdueDate?: string;
  transactions: LoanTransaction[];
}

export interface GlobalLoansSummary {
  totalReceivablePaise: number; // assets: money owed to user
  totalPayablePaise: number; // liabilities: money user owes
  netLoanPositionPaise: number; // receivable - payable
  personSummaries: PersonLoanSummary[];
}

export function calculateLoansSummary(
  loanTransactions: LoanTransaction[],
  todayStr: string = new Date().toISOString().slice(0, 10)
): GlobalLoansSummary {
  const peopleMap: Record<string, PersonLoanSummary> = {};

  for (const tx of loanTransactions) {
    if (tx.deletedAt) continue;

    const person = tx.personName.trim();
    if (!peopleMap[person]) {
      peopleMap[person] = {
        personName: person,
        totalLentPaise: 0,
        repaidToUsPaise: 0,
        outstandingReceivablePaise: 0,
        totalBorrowedPaise: 0,
        repaidByUsPaise: 0,
        outstandingPayablePaise: 0,
        isOverdue: false,
        transactions: [],
      };
    }

    const summary = peopleMap[person];
    summary.transactions.push(tx);

    switch (tx.type) {
      case 'loan_given':
        summary.totalLentPaise += tx.amountPaise;
        break;
      case 'loan_repayment_in':
        summary.repaidToUsPaise += tx.amountPaise;
        break;
      case 'loan_received':
        summary.totalBorrowedPaise += tx.amountPaise;
        break;
      case 'loan_repayment_out':
        summary.repaidByUsPaise += tx.amountPaise;
        break;
    }

    if (tx.dueDate && tx.dueDate < todayStr) {
      // Check if overdue condition applies
      if (!summary.earliestOverdueDate || tx.dueDate < summary.earliestOverdueDate) {
        summary.earliestOverdueDate = tx.dueDate;
      }
    }
  }

  let totalReceivablePaise = 0;
  let totalPayablePaise = 0;
  const personSummaries: PersonLoanSummary[] = [];

  for (const summary of Object.values(peopleMap)) {
    summary.outstandingReceivablePaise = Math.max(
      0,
      summary.totalLentPaise - summary.repaidToUsPaise
    );
    summary.outstandingPayablePaise = Math.max(
      0,
      summary.totalBorrowedPaise - summary.repaidByUsPaise
    );

    // Overdue if they owe us and date passed, or we owe them and date passed
    if (summary.earliestOverdueDate && (summary.outstandingReceivablePaise > 0 || summary.outstandingPayablePaise > 0)) {
      summary.isOverdue = true;
    }

    totalReceivablePaise += summary.outstandingReceivablePaise;
    totalPayablePaise += summary.outstandingPayablePaise;
    personSummaries.push(summary);
  }

  // Sort: overdue first, then largest outstanding
  personSummaries.sort((a, b) => {
    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
    const maxA = Math.max(a.outstandingReceivablePaise, a.outstandingPayablePaise);
    const maxB = Math.max(b.outstandingReceivablePaise, b.outstandingPayablePaise);
    return maxB - maxA;
  });

  return {
    totalReceivablePaise,
    totalPayablePaise,
    netLoanPositionPaise: totalReceivablePaise - totalPayablePaise,
    personSummaries,
  };
}

/**
 * Net worth calculation:
 * Assets: total account balances + receivable loans (money owed to us)
 * Liabilities: payable loans (money we owe)
 * Net worth = Assets - Liabilities.
 * (Uncertain earnings and unpaid platform balances are strictly excluded).
 */
export function calculateNetWorth(
  totalLiquidPaise: number,
  loansSummary: GlobalLoansSummary
): {
  totalAssetsPaise: number;
  totalLiabilitiesPaise: number;
  netWorthPaise: number;
} {
  const totalAssetsPaise = totalLiquidPaise + loansSummary.totalReceivablePaise;
  const totalLiabilitiesPaise = loansSummary.totalPayablePaise;
  return {
    totalAssetsPaise,
    totalLiabilitiesPaise,
    netWorthPaise: totalAssetsPaise - totalLiabilitiesPaise,
  };
}
