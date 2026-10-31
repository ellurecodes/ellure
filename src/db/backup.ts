import { db } from './db';
import { z } from 'zod';
import {
  Transaction,
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
 * Helper to split CSV line handling quoted commas
 */
function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

/**
 * Imports transactions from CSV with validation, duplicate detection, and formula-injection sanitization.
 */
export async function parseAndImportCsv(
  csvText: string,
  userId?: string
): Promise<{
  success: boolean;
  importedCount: number;
  skippedCount: number;
  errors: string[];
}> {
  const lines = csvText.trim().split(/\r?\n/).filter(l => l.trim().length > 0);
  if (lines.length === 0) {
    return { success: false, importedCount: 0, skippedCount: 0, errors: ['CSV file is completely empty.'] };
  }

  const rawHeaders = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  const dateIdx = rawHeaders.indexOf('date');
  const titleIdx = rawHeaders.indexOf('title');
  const typeIdx = rawHeaders.indexOf('type');
  const catIdx = rawHeaders.indexOf('category');
  const accIdx = rawHeaders.indexOf('account');
  const amtInrIdx = rawHeaders.indexOf('amount (inr)');
  const amtPaiseIdx = rawHeaders.indexOf('amount (paise)');
  const notesIdx = rawHeaders.indexOf('notes');
  const tagsIdx = rawHeaders.indexOf('tags');

  if (dateIdx === -1 || titleIdx === -1 || typeIdx === -1 || (amtInrIdx === -1 && amtPaiseIdx === -1)) {
    return {
      success: false,
      importedCount: 0,
      skippedCount: 0,
      errors: ['Invalid CSV format: Missing required columns (Date, Title, Type, and Amount).'],
    };
  }

  // Load user accounts for matching
  const accounts = userId ? await db.accounts.where('userId').equals(userId).toArray() : await db.accounts.toArray();
  const defaultAccount = accounts[0];
  if (!defaultAccount) {
    return { success: false, importedCount: 0, skippedCount: 0, errors: ['No active user account found to attach transactions.'] };
  }

  const accountByName = new Map(accounts.map(a => [a.name.toLowerCase(), a.id]));
  const existingTx = userId ? await db.transactions.where('userId').equals(userId).toArray() : await db.transactions.toArray();

  const errors: string[] = [];
  const toAdd: Transaction[] = [];
  let skippedCount = 0;
  const now = new Date().toISOString();

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const rowNum = i + 1;

    const rawDate = cols[dateIdx]?.trim();
    const rawTitle = unsanitizeCsvCell(cols[titleIdx]?.trim() || '');
    const rawType = cols[typeIdx]?.trim().toLowerCase();
    const rawCat = catIdx !== -1 ? unsanitizeCsvCell(cols[catIdx]?.trim() || '') : 'Miscellaneous';
    const rawAccName = accIdx !== -1 ? cols[accIdx]?.trim().toLowerCase() : '';
    const rawNotes = notesIdx !== -1 ? unsanitizeCsvCell(cols[notesIdx]?.trim() || '') : '';
    const rawTags = tagsIdx !== -1 ? cols[tagsIdx]?.split(',').map(t => t.trim()).filter(Boolean) : [];

    // 1. Validate Date
    if (!rawDate || !/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
      errors.push(`Row ${rowNum}: Invalid date "${rawDate}" (expected YYYY-MM-DD).`);
      continue;
    }
    const [y, m, d] = rawDate.split('-').map(Number);
    if (m < 1 || m > 12 || d < 1 || d > 31) {
      errors.push(`Row ${rowNum}: Calendar date "${rawDate}" is out of bounds.`);
      continue;
    }

    // 2. Validate Title
    if (!rawTitle) {
      errors.push(`Row ${rowNum}: Title cannot be empty.`);
      continue;
    }

    // 3. Validate Type
    if (!['income', 'expense', 'transfer', 'earning_payout', 'adjustment', 'loan_given', 'loan_received', 'loan_repayment_in', 'loan_repayment_out'].includes(rawType)) {
      errors.push(`Row ${rowNum}: Unknown transaction type "${rawType}".`);
      continue;
    }

    // 4. Validate Amount
    let amountPaise = 0;
    if (amtPaiseIdx !== -1 && cols[amtPaiseIdx]?.trim()) {
      const parsed = parseInt(cols[amtPaiseIdx].trim(), 10);
      if (isNaN(parsed) || parsed < 0) {
        errors.push(`Row ${rowNum}: Invalid amount paise "${cols[amtPaiseIdx]}".`);
        continue;
      }
      amountPaise = parsed;
    } else if (amtInrIdx !== -1 && cols[amtInrIdx]?.trim()) {
      const parsed = parseFloat(cols[amtInrIdx].trim());
      if (isNaN(parsed) || parsed < 0) {
        errors.push(`Row ${rowNum}: Invalid amount INR "${cols[amtInrIdx]}".`);
        continue;
      }
      amountPaise = Math.round(parsed * 100);
    } else {
      errors.push(`Row ${rowNum}: Amount is required.`);
      continue;
    }

    // Resolve Account
    const targetAccountId = accountByName.get(rawAccName) || defaultAccount.id;

    // Duplicate detection (soft warning / skip)
    const isDup = existingTx.some(
      t =>
        !t.deletedAt &&
        t.date === rawDate &&
        t.title.toLowerCase() === rawTitle.toLowerCase() &&
        'amountPaise' in t &&
        t.amountPaise === amountPaise
    );

    if (isDup) {
      skippedCount++;
      continue;
    }

    const txId = `tx_csv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    if (rawType === 'income') {
      toAdd.push({
        id: txId,
        userId,
        type: 'income',
        date: rawDate,
        title: rawTitle,
        accountId: targetAccountId,
        amountPaise,
        category: rawCat || 'Income',
        notes: rawNotes,
        tags: rawTags,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    } else {
      toAdd.push({
        id: txId,
        userId,
        type: 'expense',
        date: rawDate,
        title: rawTitle,
        accountId: targetAccountId,
        amountPaise,
        category: rawCat || 'Miscellaneous',
        notes: rawNotes,
        tags: rawTags,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
  }

  if (toAdd.length > 0) {
    await db.transactions.bulkAdd(toAdd);
  }

  return {
    success: errors.length === 0,
    importedCount: toAdd.length,
    skippedCount,
    errors,
  };
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
