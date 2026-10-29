import { describe, it, expect } from 'vitest';
import {
  Account,
  Transaction,
  TransferTransactionSchema,
  EarningRecord,
  Withdrawal,
  EarningPayoutTransaction,
  LoanTransaction,
  RecurringTransaction,
  Budget,
  HabitLog,
} from '../types';
import {
  deriveAccountBalance,
  deriveAllAccountBalances,
  calculateDashboardBalances,
  calculateReconciliationDelta,
} from '../balances';
import {
  calculateIncomeExpense,
  checkDuplicateTransaction,
  groupExpensesByCategory,
} from '../transactions';
import {
  convertForeignToInrPaise,
  formatInr,
  rupeesToPaise,
} from '../money';
import {
  calculateEarningsSummary,
  allocateEarningRecord,
  revertRecordAllocations,
  reclassifyEarningRecord,
} from '../earnings';
import { calculateLoansSummary, calculateNetWorth } from '../loans';
import { evaluateBudgets, calculateAllowanceMetrics } from '../budgets';
import { calculateHabitStreak } from '../habits';
import { validateSafeUrl, sanitizeCsvCell, unsanitizeCsvCell } from '../safety';
import { generateDueRecurringTransactions } from '../recurring';

describe('Domain Accounting & Financial Rules', () => {
  const dummyNow = '2026-10-29T10:00:00Z';

  // 1. Balance Derivation
  it('1. balance derivation: accurately derives balance from opening balance + ledger entries', () => {
    const bankAccount: Account = {
      id: 'acc_bank',
      name: 'SBI Savings',
      type: 'bank',
      currency: 'INR',
      openingBalancePaise: 500000, // ₹5,000.00
      isExcludedFromSpendable: false,
      isArchived: false,
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    const transactions: Transaction[] = [
      {
        id: 'tx_1',
        type: 'income',
        date: '2026-10-01',
        title: 'Freelance Design',
        accountId: 'acc_bank',
        amountPaise: 200000, // +₹2,000
        category: 'Freelance',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
      {
        id: 'tx_2',
        type: 'expense',
        date: '2026-10-02',
        title: 'Textbook Purchase',
        accountId: 'acc_bank',
        amountPaise: 75000, // -₹750
        category: 'Education',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
    ];

    // Opening ₹5000 + ₹2000 - ₹750 = ₹6250 (625000 paise)
    const derived = deriveAccountBalance(bankAccount, transactions);
    expect(derived).toBe(625000);
  });

  // 2. Transfer Does Not Change Income/Expense Totals
  it('2. transfer does not change income/expense totals', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_inc',
        type: 'income',
        date: '2026-10-05',
        title: 'Stipend',
        accountId: 'acc_bank',
        amountPaise: 1000000, // ₹10,000
        category: 'Stipend',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
      {
        id: 'tx_exp',
        type: 'expense',
        date: '2026-10-06',
        title: 'Hostel Rent',
        accountId: 'acc_bank',
        amountPaise: 400000, // ₹4,000
        category: 'Rent',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
      {
        id: 'tx_transfer',
        type: 'transfer',
        date: '2026-10-07',
        title: 'ATM Cash Withdrawal',
        fromAccountId: 'acc_bank',
        toAccountId: 'acc_cash',
        amountPaise: 200000, // ₹2,000
        feePaise: 0,
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
    ];

    const summary = calculateIncomeExpense(transactions);
    expect(summary.totalIncomePaise).toBe(1000000); // Only stipend
    expect(summary.totalExpensePaise).toBe(400000); // Only hostel rent
    expect(summary.netSavingsPaise).toBe(600000); // 10000 - 4000
  });

  // 3. Same-Account Transfer Rejected
  it('3. same-account transfer rejected by schema validation', () => {
    const invalidTransfer = {
      id: 'tx_bad_transfer',
      type: 'transfer',
      date: '2026-10-10',
      title: 'Self transfer to same account',
      fromAccountId: 'acc_bank_1',
      toAccountId: 'acc_bank_1', // SAME
      amountPaise: 50000,
      feePaise: 0,
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
      tags: [],
      notes: '',
    };

    const result = TransferTransactionSchema.safeParse(invalidTransfer);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('must be different');
    }
  });

  // 4. Adjustment Excluded from Income/Expense
  it('4. adjustment excluded from income/expense totals', () => {
    const transactions: Transaction[] = [
      {
        id: 'tx_adj',
        type: 'adjustment',
        date: '2026-10-12',
        title: 'Reconcile SBI Passbook',
        accountId: 'acc_bank',
        deltaPaise: 15000, // +₹150 difference
        statedBalancePaise: 515000,
        computedBalancePaise: 500000,
        reason: 'Interest credited not previously tracked',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
    ];

    const summary = calculateIncomeExpense(transactions);
    expect(summary.totalIncomePaise).toBe(0);
    expect(summary.totalExpensePaise).toBe(0);
  });

  // 5. Loan Flows Excluded from Income/Expense
  it('5. loan flows excluded from income/expense', () => {
    const loanTransactions: LoanTransaction[] = [
      {
        id: 'ln_1',
        type: 'loan_given',
        date: '2026-10-15',
        title: 'Lent money to Rahul for exam fee',
        accountId: 'acc_upi',
        amountPaise: 150000, // ₹1,500 lent out
        personName: 'Rahul',
        dueDate: '2026-11-01',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
      {
        id: 'ln_2',
        type: 'loan_repayment_in',
        date: '2026-10-20',
        title: 'Rahul repaid exam fee',
        accountId: 'acc_upi',
        amountPaise: 150000, // ₹1,500 repaid back
        personName: 'Rahul',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
    ];

    const summary = calculateIncomeExpense(loanTransactions);
    expect(summary.totalIncomePaise).toBe(0);
    expect(summary.totalExpensePaise).toBe(0);
  });

  // 6. Foreign Currency Conversion
  it('6. foreign currency conversion: converts foreign minor units to integer paise using user rate without floats', () => {
    // $15.50 USD at ₹83.75 per USD
    // $15.50 = 1550 cents
    const cents = 1550;
    const userEnteredRate = 83.75;
    const computedPaise = convertForeignToInrPaise(cents, userEnteredRate);

    // 1550 * 83.75 = 129812.5 -> rounds to 129813 paise (₹1,298.13)
    expect(computedPaise).toBe(129813);
    expect(Number.isInteger(computedPaise)).toBe(true);
    expect(formatInr(computedPaise)).toBe('₹1,298.13');
  });

  // 7. Soft Delete Excluded from Balances
  it('7. soft delete excluded from balances', () => {
    const wallet: Account = {
      id: 'acc_wallet',
      name: 'Paytm Wallet',
      type: 'wallet',
      currency: 'INR',
      openingBalancePaise: 100000, // ₹1,000
      isExcludedFromSpendable: false,
      isArchived: false,
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    const transactions: Transaction[] = [
      {
        id: 'tx_active',
        type: 'expense',
        date: '2026-10-21',
        title: 'Chai & Snacks',
        accountId: 'acc_wallet',
        amountPaise: 5000, // ₹50
        category: 'Food',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
      {
        id: 'tx_deleted',
        type: 'expense',
        date: '2026-10-22',
        title: 'Accidental Duplicate',
        accountId: 'acc_wallet',
        amountPaise: 50000, // ₹500
        category: 'Food',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: '2026-10-22T12:00:00Z', // SOFT DELETED
        tags: [],
        notes: '',
      },
    ];

    const balance = deriveAccountBalance(wallet, transactions);
    // ₹1000 - ₹50 = ₹950 (95000 paise). The deleted ₹500 is ignored.
    expect(balance).toBe(95000);
  });

  // 8. Undo Restore
  it('8. undo restore: restoring soft-deleted item restores balance effect', () => {
    const wallet: Account = {
      id: 'acc_wallet',
      name: 'Paytm Wallet',
      type: 'wallet',
      currency: 'INR',
      openingBalancePaise: 100000,
      isExcludedFromSpendable: false,
      isArchived: false,
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    const tx: Transaction = {
      id: 'tx_restored',
      type: 'expense',
      date: '2026-10-21',
      title: 'Chai',
      accountId: 'acc_wallet',
      amountPaise: 5000,
      category: 'Food',
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: '2026-10-22T10:00:00Z',
      tags: [],
      notes: '',
    };

    // Before restore (soft-deleted)
    expect(deriveAccountBalance(wallet, [tx])).toBe(100000);

    // After undo restore (deletedAt = null)
    const restoredTx: Transaction = { ...tx, deletedAt: null };
    expect(deriveAccountBalance(wallet, [restoredTx])).toBe(95000);
  });

  // 9. Earning Lifecycle: ₹100 Pending, Then ₹100 Payout -> Lifetime ₹100, Bank +₹100, Platform Pending ₹0
  it('9. earning lifecycle: ₹100 pending then ₹100 payout results in lifetime ₹100, bank +₹100, platform pending ₹0', () => {
    const bankAccount: Account = {
      id: 'acc_bank',
      name: 'HDFC Bank',
      type: 'bank',
      currency: 'INR',
      openingBalancePaise: 0,
      isExcludedFromSpendable: false,
      isArchived: false,
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    // Stage 1: User adds ₹100 verified earning record (pending withdrawal)
    const earningRecord: EarningRecord = {
      id: 'rec_1',
      platformId: 'plat_upwork',
      date: '2026-10-10',
      title: 'Website Logo Design',
      amountMinorUnits: 10000, // ₹100.00
      currency: 'INR',
      exchangeRateToInr: 1,
      exchangeRateDate: '',
      inrAmountPaise: 10000, // ₹100.00
      classification: 'verified',
      allocatedToWithdrawalPaise: 0,
      auditTrail: [],
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    // Stage 1 Verification
    let summary1 = calculateEarningsSummary([earningRecord], [], [], []);
    let bankBalance1 = deriveAccountBalance(bankAccount, []);
    let ledger1 = calculateIncomeExpense([]);

    expect(summary1.verifiedPendingPaise).toBe(10000); // ₹100 pending
    expect(summary1.verifiedReceivedPaise).toBe(0);
    expect(summary1.lifetimeEarningsPaise).toBe(10000); // ₹100 total
    expect(bankBalance1).toBe(0); // Bank has not received money yet
    expect(ledger1.totalIncomePaise).toBe(0); // Ledger income is ₹0

    // Stage 2: User requests withdrawal and receives payout of ₹100 into Bank
    const updatedRecord: EarningRecord = {
      ...earningRecord,
      allocatedToWithdrawalPaise: 10000, // fully allocated
    };

    const withdrawal: Withdrawal = {
      id: 'w_1',
      platformId: 'plat_upwork',
      requestedDate: '2026-10-12',
      amountPaise: 10000,
      status: 'received',
      allocations: [{ earningRecordId: 'rec_1', allocatedPaise: 10000 }],
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    const payoutTx: EarningPayoutTransaction = {
      id: 'tx_payout_1',
      type: 'earning_payout',
      date: '2026-10-14',
      title: 'Upwork Payout to HDFC',
      accountId: 'acc_bank',
      amountPaise: 10000, // +₹100
      platformId: 'plat_upwork',
      withdrawalId: 'w_1',
      grossPaise: 10000,
      feePaise: 0,
      allocatedRecordIds: ['rec_1'],
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
      tags: [],
      notes: '',
    };

    // Stage 2 Verification
    let summary2 = calculateEarningsSummary([updatedRecord], [withdrawal], [payoutTx], []);
    let bankBalance2 = deriveAccountBalance(bankAccount, [payoutTx]);
    let ledger2 = calculateIncomeExpense([payoutTx]);

    expect(summary2.verifiedPendingPaise).toBe(0); // Pending is now ₹0
    expect(summary2.verifiedReceivedPaise).toBe(10000); // Received is ₹100
    expect(summary2.lifetimeEarningsPaise).toBe(10000); // Lifetime earnings remains ₹100, NOT ₹200!
    expect(bankBalance2).toBe(10000); // Bank received +₹100
    expect(ledger2.totalIncomePaise).toBe(10000); // Ledger income is +₹100 exactly once
  });

  // 10. Partial Payout
  it('10. partial payout: ₹60 of ₹100 received leaves ₹40 pending', () => {
    const earningRecord: EarningRecord = {
      id: 'rec_partial',
      platformId: 'plat_fiverr',
      date: '2026-10-15',
      title: 'Translation Project',
      amountMinorUnits: 10000, // ₹100.00
      currency: 'INR',
      exchangeRateToInr: 1,
      exchangeRateDate: '',
      inrAmountPaise: 10000,
      classification: 'verified',
      allocatedToWithdrawalPaise: 0,
      auditTrail: [],
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    // Allocate ₹60
    const allocResult = allocateEarningRecord(earningRecord, 6000);
    expect(allocResult.success).toBe(true);
    const partiallyAllocated = allocResult.updatedRecord!;
    expect(partiallyAllocated.allocatedToWithdrawalPaise).toBe(6000);

    const summary = calculateEarningsSummary([partiallyAllocated], [], [], []);
    expect(summary.verifiedPendingPaise).toBe(4000); // Remaining ₹40 pending
  });

  // 11. Over-Allocation Rejected
  it('11. over-allocation rejected: cannot allocate more than remaining balance', () => {
    const earningRecord: EarningRecord = {
      id: 'rec_over',
      platformId: 'plat_test',
      date: '2026-10-16',
      title: 'Tutoring',
      amountMinorUnits: 5000, // ₹50.00
      currency: 'INR',
      exchangeRateToInr: 1,
      exchangeRateDate: '',
      inrAmountPaise: 5000,
      classification: 'verified',
      allocatedToWithdrawalPaise: 3000, // already ₹30 allocated, ₹20 remaining
      auditTrail: [],
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    // Attempt to allocate ₹25 (more than the remaining ₹20)
    const allocResult = allocateEarningRecord(earningRecord, 2500);
    expect(allocResult.success).toBe(false);
    expect(allocResult.error).toContain('only ₹20.00 remaining');
  });

  // 12. Fee Handling
  it('12. fee handling: platform withdrawal fee correctly records gross vs net received', () => {
    const bankAccount: Account = {
      id: 'acc_bank',
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      openingBalancePaise: 0,
      isExcludedFromSpendable: false,
      isArchived: false,
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    // Gross $100 (₹8,000), Fee $5 (₹400), Net Received $95 (₹7,600)
    const payoutTx: EarningPayoutTransaction = {
      id: 'tx_payout_fee',
      type: 'earning_payout',
      date: '2026-10-18',
      title: 'Platform Payout (after ₹400 fee)',
      accountId: 'acc_bank',
      amountPaise: 760000, // net credited to bank
      grossPaise: 800000, // gross
      feePaise: 40000, // fee
      platformId: 'plat_1',
      allocatedRecordIds: [],
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
      tags: [],
      notes: '',
    };

    const balance = deriveAccountBalance(bankAccount, [payoutTx]);
    expect(balance).toBe(760000); // Exactly net credited
  });

  // 13. Failed/Rejected Withdrawal Restores Pending
  it('13. failed/rejected withdrawal restores pending amount', () => {
    const earningRecord: EarningRecord = {
      id: 'rec_failed',
      platformId: 'plat_test',
      date: '2026-10-19',
      title: 'Transcription',
      amountMinorUnits: 8000, // ₹80
      currency: 'INR',
      exchangeRateToInr: 1,
      exchangeRateDate: '',
      inrAmountPaise: 8000,
      classification: 'verified',
      allocatedToWithdrawalPaise: 8000, // currently locked in withdrawal
      auditTrail: [],
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    // Revert ₹80 because withdrawal was rejected by platform
    const revertedRecords = revertRecordAllocations([earningRecord], [
      { earningRecordId: 'rec_failed', amountPaise: 8000 },
    ]);

    expect(revertedRecords[0].allocatedToWithdrawalPaise).toBe(0);
    const summary = calculateEarningsSummary(revertedRecords, [], [], []);
    expect(summary.verifiedPendingPaise).toBe(8000); // Fully pending again
  });

  // 14. Reclassification Does Not Move Ledger Money
  it('14. reclassification does not move ledger money or alter account balances', () => {
    const bankAccount: Account = {
      id: 'acc_bank',
      name: 'Bank',
      type: 'bank',
      currency: 'INR',
      openingBalancePaise: 100000, // ₹1,000
      isExcludedFromSpendable: false,
      isArchived: false,
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    const record: EarningRecord = {
      id: 'rec_reclass',
      platformId: 'plat_surveys',
      date: '2026-10-20',
      title: 'Survey Rewards',
      amountMinorUnits: 50000, // ₹500
      currency: 'INR',
      exchangeRateToInr: 1,
      exchangeRateDate: '',
      inrAmountPaise: 50000,
      classification: 'uncertain',
      confidenceLevel: 'medium',
      reasonForUncertainty: 'Points awaiting audit',
      reviewDate: '2026-10-30',
      allocatedToWithdrawalPaise: 0,
      auditTrail: [],
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    // Reclassify from Uncertain to Verified
    const reclassified = reclassifyEarningRecord(record, 'verified', 'Survey points cleared audit');
    expect(reclassified.classification).toBe('verified');
    expect(reclassified.auditTrail?.length).toBe(1);
    expect(reclassified.auditTrail?.[0]?.reason).toBe('Survey points cleared audit');

    // Balance of bank account must remain unchanged (0 transactions changed)
    const balance = deriveAccountBalance(bankAccount, []);
    expect(balance).toBe(100000);
  });

  // 15. Deleting a Payout Reverts Linked Records
  it('15. deleting a payout reverts linked records to previous pending state', () => {
    const record: EarningRecord = {
      id: 'rec_linked',
      platformId: 'plat_1',
      date: '2026-10-22',
      title: 'Coding Gig',
      amountMinorUnits: 250000, // ₹2,500
      currency: 'INR',
      exchangeRateToInr: 1,
      exchangeRateDate: '',
      inrAmountPaise: 250000,
      classification: 'verified',
      allocatedToWithdrawalPaise: 250000, // was allocated
      auditTrail: [],
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    // Deleting payout with allocation of ₹2,500
    const restored = revertRecordAllocations([record], [
      { earningRecordId: 'rec_linked', amountPaise: 250000 },
    ]);

    expect(restored[0].allocatedToWithdrawalPaise).toBe(0);
  });

  // 16. Recurring Generation is Idempotent
  it('16. recurring generation is idempotent (no duplicates on repeated execution)', () => {
    const recurringSchedule: RecurringTransaction = {
      id: 'rec_wifi',
      title: 'Hostel WiFi Bill',
      amountPaise: 69900, // ₹699
      type: 'expense',
      category: 'Recharge/Internet',
      accountId: 'acc_bank',
      frequency: 'monthly',
      startDate: '2026-10-01',
      nextDueDate: '2026-10-01',
      isActive: true,
      notes: '',
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
    };

    const existingTransactions: Transaction[] = [];

    // First generation run
    const run1 = generateDueRecurringTransactions([recurringSchedule], existingTransactions, '2026-10-15');
    expect(run1.newTransactions.length).toBe(1);
    expect(run1.newTransactions[0].amountPaise).toBe(69900);

    // Second run with the generated transaction in existing list
    const combinedTransactions = [...existingTransactions, ...run1.newTransactions];
    const run2 = generateDueRecurringTransactions(run1.updatedSchedules, combinedTransactions, '2026-10-15');

    // Must NOT create duplicate transactions
    expect(run2.newTransactions.length).toBe(0);
  });

  // 17. Budget Thresholds
  it('17. budget thresholds: detects 80% warning and 100% exceeded thresholds', () => {
    const budgets: Budget[] = [
      {
        id: 'b_food',
        category: 'Food',
        month: '2026-10',
        amountPaise: 500000, // ₹5,000 budget
        createdAt: dummyNow,
        updatedAt: dummyNow,
      },
      {
        id: 'b_total',
        category: 'total',
        month: '2026-10',
        amountPaise: 1000000, // ₹10,000 total budget
        createdAt: dummyNow,
        updatedAt: dummyNow,
      },
    ];

    // Spend ₹4,200 on Food (84% -> near limit warning)
    const txFood: Transaction = {
      id: 'tx_f',
      type: 'expense',
      date: '2026-10-10',
      title: 'Groceries & Canteen',
      accountId: 'acc_upi',
      amountPaise: 420000,
      category: 'Food',
      createdAt: dummyNow,
      updatedAt: dummyNow,
      deletedAt: null,
      tags: [],
      notes: '',
    };

    const eval1 = evaluateBudgets(budgets, [txFood], '2026-10');
    const foodStatus = eval1.categoryStatuses.find(c => c.category === 'Food')!;
    expect(foodStatus.percentageUsed).toBe(84);
    expect(foodStatus.isNearLimit).toBe(true);
    expect(foodStatus.isOverBudget).toBe(false);

    // Additional spend of ₹1,000 on Food -> total ₹5,200 (104% -> over budget)
    const txFood2: Transaction = {
      ...txFood,
      id: 'tx_f2',
      amountPaise: 100000,
    };

    const eval2 = evaluateBudgets(budgets, [txFood, txFood2], '2026-10');
    const foodStatus2 = eval2.categoryStatuses.find(c => c.category === 'Food')!;
    expect(foodStatus2.percentageUsed).toBe(104);
    expect(foodStatus2.isOverBudget).toBe(true);
  });

  // 18. Streak Logic
  it('18. streak logic: correctly calculates current and longest streaks handling missed days and today', () => {
    const today = '2026-10-29';

    // Case A: completed on 27th, 28th, 29th (today) -> streak = 3
    const logsA: HabitLog[] = [
      { id: '1', habitId: 'h1', date: '2026-10-27', completed: true },
      { id: '2', habitId: 'h1', date: '2026-10-28', completed: true },
      { id: '3', habitId: 'h1', date: '2026-10-29', completed: true },
    ];
    const streakA = calculateHabitStreak(logsA, today);
    expect(streakA.currentStreak).toBe(3);
    expect(streakA.completedToday).toBe(true);

    // Case B: completed on 27th, 28th, but NOT yet today -> streak stays 2 (still alive from yesterday)
    const logsB: HabitLog[] = [
      { id: '1', habitId: 'h1', date: '2026-10-27', completed: true },
      { id: '2', habitId: 'h1', date: '2026-10-28', completed: true },
    ];
    const streakB = calculateHabitStreak(logsB, today);
    expect(streakB.currentStreak).toBe(2);
    expect(streakB.completedToday).toBe(false);

    // Case C: missed yesterday (28th), last completed on 27th, not today -> streak reset to 0
    const logsC: HabitLog[] = [
      { id: '1', habitId: 'h1', date: '2026-10-26', completed: true },
      { id: '2', habitId: 'h1', date: '2026-10-27', completed: true },
    ];
    const streakC = calculateHabitStreak(logsC, today);
    expect(streakC.currentStreak).toBe(0);
    expect(streakC.longestStreak).toBe(2);
  });

  // 19. URL Validation
  it('19. URL validation: allows http/https, rejects javascript/data/malformed, extracts hostname', () => {
    expect(validateSafeUrl('https://freelancer.in/dashboard').isValid).toBe(true);
    expect(validateSafeUrl('https://freelancer.in/dashboard').hostname).toBe('freelancer.in');

    expect(validateSafeUrl('http://localhost:3000').isValid).toBe(true);

    expect(validateSafeUrl('javascript:alert(1)').isValid).toBe(false);
    expect(validateSafeUrl('data:text/html,<script>alert(1)</script>').isValid).toBe(false);
    expect(validateSafeUrl('vbscript:msgbox(1)').isValid).toBe(false);
    expect(validateSafeUrl('not-a-valid-url').isValid).toBe(false);
  });

  // 20. CSV Import Validation and Formula-Injection Sanitization
  it('20. CSV import validation and formula-injection sanitization', () => {
    // Dangerous formulas starting with = + - @
    const dangerous1 = '=SUM(A1:A10)';
    const dangerous2 = '+cmd|"/C calc"!A0';
    const dangerous3 = '-10*20';
    const dangerous4 = '@HYPERLINK("http://evil.com")';

    expect(sanitizeCsvCell(dangerous1)).toBe("'=SUM(A1:A10)");
    expect(sanitizeCsvCell(dangerous2)).toBe("'+cmd|\"/C calc\"!A0");
    expect(sanitizeCsvCell(dangerous3)).toBe("'-10*20");
    expect(sanitizeCsvCell(dangerous4)).toBe("'@HYPERLINK(\"http://evil.com\")");

    // Regular strings left clean
    expect(sanitizeCsvCell('Mess Bill')).toBe('Mess Bill');

    // Unsanitize restores formula text without quote
    expect(unsanitizeCsvCell("'-10*20")).toBe('-10*20');
  });

  // 21. Backup/Restore Round Trip & Loans Summary
  it('21. backup/restore round trip: loans summary and net worth calculated strictly from real data', () => {
    const loanTxs: LoanTransaction[] = [
      {
        id: 'ln_given',
        type: 'loan_given',
        date: '2026-10-01',
        title: 'Loan to Priya',
        accountId: 'acc_upi',
        amountPaise: 500000, // ₹5,000
        personName: 'Priya',
        dueDate: '2026-10-25',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
      {
        id: 'ln_rep',
        type: 'loan_repayment_in',
        date: '2026-10-10',
        title: 'Priya partial repayment',
        accountId: 'acc_upi',
        amountPaise: 200000, // ₹2,000
        personName: 'Priya',
        createdAt: dummyNow,
        updatedAt: dummyNow,
        deletedAt: null,
        tags: [],
        notes: '',
      },
    ];

    const loansSummary = calculateLoansSummary(loanTxs, '2026-10-29');
    expect(loansSummary.totalReceivablePaise).toBe(300000); // Priya owes ₹3,000
    expect(loansSummary.personSummaries[0].isOverdue).toBe(true); // Due Oct 25th < Oct 29th

    // Net worth with ₹10,000 liquid cash
    const netWorth = calculateNetWorth(1000000, loansSummary);
    expect(netWorth.totalAssetsPaise).toBe(1300000); // 10,000 + 3,000 = ₹13,000
    expect(netWorth.totalLiabilitiesPaise).toBe(0);
    expect(netWorth.netWorthPaise).toBe(1300000);
  });
});
