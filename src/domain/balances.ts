import { Account, Transaction, AccountType } from './types';

/**
 * Derives the balance of a single account in integer paise.
 * Balance = openingBalancePaise + sum of all valid, non-deleted ledger entries affecting this account.
 */
export function deriveAccountBalance(
  account: Account,
  transactions: Transaction[]
): number {
  let balance = account.openingBalancePaise;

  for (const tx of transactions) {
    if (tx.deletedAt) continue; // Soft-deleted items are strictly excluded

    switch (tx.type) {
      case 'income':
        if (tx.accountId === account.id) {
          balance += tx.amountPaise;
        }
        break;

      case 'expense':
        if (tx.accountId === account.id) {
          balance -= tx.amountPaise;
        }
        break;

      case 'transfer':
        if (tx.fromAccountId === account.id) {
          balance -= tx.amountPaise;
          // If transfer records a direct fee without a separate linked expense
          if (tx.feePaise && !tx.linkedFeeExpenseId) {
            balance -= tx.feePaise;
          }
        }
        if (tx.toAccountId === account.id) {
          balance += tx.amountPaise;
        }
        break;

      case 'earning_payout':
        if (tx.accountId === account.id) {
          balance += tx.amountPaise;
        }
        break;

      case 'loan_given':
        // We gave money out to a person from this account
        if (tx.accountId === account.id) {
          balance -= tx.amountPaise;
        }
        break;

      case 'loan_received':
        // We received borrowed money into this account
        if (tx.accountId === account.id) {
          balance += tx.amountPaise;
        }
        break;

      case 'loan_repayment_in':
        // A borrower repaid us money into this account
        if (tx.accountId === account.id) {
          balance += tx.amountPaise;
        }
        break;

      case 'loan_repayment_out':
        // We paid back borrowed money from this account
        if (tx.accountId === account.id) {
          balance -= tx.amountPaise;
        }
        break;

      case 'adjustment':
        // Reconciliation delta applied to this account
        if (tx.accountId === account.id) {
          balance += tx.deltaPaise;
        }
        break;
    }
  }

  return balance;
}

export interface AccountBalancesMap {
  [accountId: string]: number; // in paise
}

export function deriveAllAccountBalances(
  accounts: Account[],
  transactions: Transaction[]
): AccountBalancesMap {
  const map: AccountBalancesMap = {};
  for (const acc of accounts) {
    map[acc.id] = deriveAccountBalance(acc, transactions);
  }
  return map;
}

export interface DashboardBalanceSummary {
  cashPaise: number;
  bankPaise: number;
  upiDigitalPaise: number;
  walletPaise: number;
  totalSpendablePaise: number;
  totalLiquidPaise: number; // all non-archived accounts regardless of spendable toggle
  excludedFromSpendablePaise: number;
}

/**
 * Calculates dashboard totals by account category and spendable sum.
 */
export function calculateDashboardBalances(
  accounts: Account[],
  transactions: Transaction[]
): DashboardBalanceSummary {
  const balances = deriveAllAccountBalances(accounts, transactions);

  let cashPaise = 0;
  let bankPaise = 0;
  let upiDigitalPaise = 0;
  let walletPaise = 0;
  let totalSpendablePaise = 0;
  let totalLiquidPaise = 0;
  let excludedFromSpendablePaise = 0;

  for (const acc of accounts) {
    if (acc.deletedAt || acc.isArchived) continue;

    const balance = balances[acc.id] ?? 0;
    totalLiquidPaise += balance;

    switch (acc.type) {
      case 'cash':
        cashPaise += balance;
        break;
      case 'bank':
      case 'upi':
      case 'other_digital':
        upiDigitalPaise += balance;
        bankPaise += balance;
        break;
      case 'wallet':
        walletPaise += balance;
        break;
    }

    if (!acc.isExcludedFromSpendable) {
      totalSpendablePaise += balance;
    } else {
      excludedFromSpendablePaise += balance;
    }
  }

  return {
    cashPaise,
    bankPaise,
    upiDigitalPaise,
    walletPaise,
    totalSpendablePaise,
    totalLiquidPaise,
    excludedFromSpendablePaise,
  };
}

/**
 * Calculates reconciliation adjustment needed when a user manually updates an account balance.
 * Returns deltaPaise (difference between stated and computed balance).
 */
export function calculateReconciliationDelta(
  statedBalancePaise: number,
  computedBalancePaise: number
): number {
  return statedBalancePaise - computedBalancePaise;
}
