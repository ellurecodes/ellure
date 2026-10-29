import { db } from './db';
import { z } from 'zod';
import {
  AccountSchema,
  TransactionSchema,
  PlatformSchema,
  EarningRecordSchema,
  WithdrawalSchema,
  BudgetSchema,
  SavingsGoalSchema,
  RecurringTransactionSchema,
  SubjectSchema,
  AcademicTaskSchema,
  HabitSchema,
  HabitLogSchema,
  GoalSchema,
} from '../domain/types';
import { sanitizeCsvCell, unsanitizeCsvCell } from '../domain/safety';

export const BACKUP_SCHEMA_VERSION = 1;

export const BackupPayloadSchema = z.object({
  version: z.number().int().min(1),
  exportedAt: z.string(),
  appName: z.literal('LifeOS'),
  data: z.object({
    accounts: z.array(AccountSchema),
    transactions: z.array(TransactionSchema),
    platforms: z.array(PlatformSchema),
    earningRecords: z.array(EarningRecordSchema),
    withdrawals: z.array(WithdrawalSchema),
    budgets: z.array(BudgetSchema),
    savingsGoals: z.array(SavingsGoalSchema),
    recurringTransactions: z.array(RecurringTransactionSchema),
    subjects: z.array(SubjectSchema),
    academicTasks: z.array(AcademicTaskSchema),
    habits: z.array(HabitSchema),
    habitLogs: z.array(HabitLogSchema),
    goals: z.array(GoalSchema),
  }),
});

export type BackupPayload = z.infer<typeof BackupPayloadSchema>;

/**
 * Creates a complete JSON export of all local database tables.
 */
export async function createFullBackup(): Promise<string> {
  const [
    accounts,
    transactions,
    platforms,
    earningRecords,
    withdrawals,
    budgets,
    savingsGoals,
    recurringTransactions,
    subjects,
    academicTasks,
    habits,
    habitLogs,
    goals,
  ] = await Promise.all([
    db.accounts.toArray(),
    db.transactions.toArray(),
    db.platforms.toArray(),
    db.earningRecords.toArray(),
    db.withdrawals.toArray(),
    db.budgets.toArray(),
    db.savingsGoals.toArray(),
    db.recurringTransactions.toArray(),
    db.subjects.toArray(),
    db.academicTasks.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.goals.toArray(),
  ]);

  const payload: BackupPayload = {
    version: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    appName: 'LifeOS',
    data: {
      accounts,
      transactions,
      platforms,
      earningRecords,
      withdrawals,
      budgets,
      savingsGoals,
      recurringTransactions,
      subjects,
      academicTasks,
      habits,
      habitLogs,
      goals,
    },
  };

  return JSON.stringify(payload, null, 2);
}

/**
 * Validates and inspects a JSON backup string before restoring.
 */
export function inspectBackupJson(jsonString: string): {
  isValid: boolean;
  error?: string;
  payload?: BackupPayload;
  summary?: Record<string, number>;
} {
  try {
    const raw = JSON.parse(jsonString);
    const parsed = BackupPayloadSchema.safeParse(raw);

    if (!parsed.success) {
      return {
        isValid: false,
        error: `Invalid backup schema: ${parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')}`,
      };
    }

    const d = parsed.data.data;
    const summary = {
      Accounts: d.accounts.length,
      Transactions: d.transactions.length,
      Platforms: d.platforms.length,
      'Earning Records': d.earningRecords.length,
      Withdrawals: d.withdrawals.length,
      Budgets: d.budgets.length,
      'Savings Goals': d.savingsGoals.length,
      Subjects: d.subjects.length,
      'Academic Tasks': d.academicTasks.length,
      Habits: d.habits.length,
      Goals: d.goals.length,
    };

    return { isValid: true, payload: parsed.data, summary };
  } catch (err: any) {
    return { isValid: false, error: err.message || 'Malformed JSON file' };
  }
}

/**
 * Restores database from validated backup.
 * If mode === 'replace', a temporary safety snapshot is returned.
 */
export async function restoreBackup(
  payload: BackupPayload,
  mode: 'replace' | 'merge'
): Promise<{ safetyBackupJson?: string }> {
  let safetyBackupJson: string | undefined;

  if (mode === 'replace') {
    // Generate safety backup before wiping
    safetyBackupJson = await createFullBackup();

    await db.transaction(
      'rw',
      [
        db.accounts,
        db.transactions,
        db.platforms,
        db.earningRecords,
        db.withdrawals,
        db.budgets,
        db.savingsGoals,
        db.recurringTransactions,
        db.subjects,
        db.academicTasks,
        db.habits,
        db.habitLogs,
        db.goals,
      ],
      async () => {
        await Promise.all([
          db.accounts.clear(),
          db.transactions.clear(),
          db.platforms.clear(),
          db.earningRecords.clear(),
          db.withdrawals.clear(),
          db.budgets.clear(),
          db.savingsGoals.clear(),
          db.recurringTransactions.clear(),
          db.subjects.clear(),
          db.academicTasks.clear(),
          db.habits.clear(),
          db.habitLogs.clear(),
          db.goals.clear(),
        ]);

        const d = payload.data;
        await Promise.all([
          db.accounts.bulkAdd(d.accounts),
          db.transactions.bulkAdd(d.transactions),
          db.platforms.bulkAdd(d.platforms),
          db.earningRecords.bulkAdd(d.earningRecords),
          db.withdrawals.bulkAdd(d.withdrawals),
          db.budgets.bulkAdd(d.budgets),
          db.savingsGoals.bulkAdd(d.savingsGoals),
          db.recurringTransactions.bulkAdd(d.recurringTransactions),
          db.subjects.bulkAdd(d.subjects),
          db.academicTasks.bulkAdd(d.academicTasks),
          db.habits.bulkAdd(d.habits),
          db.habitLogs.bulkAdd(d.habitLogs),
          db.goals.bulkAdd(d.goals),
        ]);
      }
    );
  } else {
    // Merge mode: bulkPut
    const d = payload.data;
    await Promise.all([
      db.accounts.bulkPut(d.accounts),
      db.transactions.bulkPut(d.transactions),
      db.platforms.bulkPut(d.platforms),
      db.earningRecords.bulkPut(d.earningRecords),
      db.withdrawals.bulkPut(d.withdrawals),
      db.budgets.bulkPut(d.budgets),
      db.savingsGoals.bulkPut(d.savingsGoals),
      db.recurringTransactions.bulkPut(d.recurringTransactions),
      db.subjects.bulkPut(d.subjects),
      db.academicTasks.bulkPut(d.academicTasks),
      db.habits.bulkPut(d.habits),
      db.habitLogs.bulkPut(d.habitLogs),
      db.goals.bulkPut(d.goals),
    ]);
  }

  return { safetyBackupJson };
}

/**
 * Exports transactions to CSV format with formula injection sanitization.
 */
export async function exportTransactionsCsv(): Promise<string> {
  const transactions = await db.transactions.toArray();
  const accounts = await db.accounts.toArray();
  const accountMap = new Map(accounts.map(a => [a.id, a.name]));

  const headers = [
    'Date',
    'Title',
    'Type',
    'Category',
    'Account',
    'Amount (INR)',
    'Amount (Paise)',
    'Tags',
    'Notes',
    'Status',
  ];

  const rows = transactions.map(t => {
    let accountName = '';
    let amountInr = 0;
    if ('accountId' in t) {
      accountName = accountMap.get(t.accountId) || t.accountId;
    } else if (t.type === 'transfer') {
      const from = accountMap.get(t.fromAccountId) || t.fromAccountId;
      const to = accountMap.get(t.toAccountId) || t.toAccountId;
      accountName = `${from} -> ${to}`;
    }

    if (t.type === 'transfer') {
      amountInr = t.amountPaise / 100;
    } else if (t.type === 'adjustment') {
      amountInr = t.deltaPaise / 100;
    } else {
      amountInr = t.amountPaise / 100;
    }

    return [
      sanitizeCsvCell(t.date),
      sanitizeCsvCell(t.title),
      sanitizeCsvCell(t.type),
      sanitizeCsvCell('category' in t ? t.category : ''),
      sanitizeCsvCell(accountName),
      sanitizeCsvCell(amountInr.toFixed(2)),
      sanitizeCsvCell(t.type === 'adjustment' ? t.deltaPaise : t.amountPaise),
      sanitizeCsvCell(t.tags?.join(',') || ''),
      sanitizeCsvCell(t.notes || ''),
      sanitizeCsvCell(t.deletedAt ? 'Deleted' : 'Active'),
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Checks and requests persistent storage from the browser.
 */
export async function checkAndRequestStoragePersistence(): Promise<{
  isSupported: boolean;
  isPersisted: boolean;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
    const isPersisted = await navigator.storage.persisted();
    if (!isPersisted) {
      const granted = await navigator.storage.persist();
      return { isSupported: true, isPersisted: granted };
    }
    return { isSupported: true, isPersisted: true };
  }
  return { isSupported: false, isPersisted: false };
}
