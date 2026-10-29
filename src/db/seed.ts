import { db } from './db';
import {
  Account,
  Transaction,
  Platform,
  EarningRecord,
  Withdrawal,
  EarningPayoutTransaction,
  Subject,
  AcademicTask,
  Habit,
  HabitLog,
  Goal,
  Budget,
  UserSettings,
} from '../domain/types';

export const DEFAULT_CATEGORIES = [
  { name: 'Food & Canteen', color: '#f97316' },
  { name: 'Hostel & Rent', color: '#6366f1' },
  { name: 'Books & Stationery', color: '#0ea5e9' },
  { name: 'Recharge & Internet', color: '#10b981' },
  { name: 'Transport & Metro', color: '#eab308' },
  { name: 'Snacks & Chai', color: '#ec4899' },
  { name: 'Entertainment', color: '#8b5cf6' },
  { name: 'Health & Personal Care', color: '#14b8a6' },
  { name: 'Subscriptions', color: '#64748b' },
  { name: 'Miscellaneous', color: '#94a3b8' },
];

export const DEFAULT_USER_SETTINGS: UserSettings = {
  id: 'current_user_settings',
  studentName: 'Student',
  monthlyAllowancePaise: 800000, // ₹8,000 / month
  allowanceResetDay: 1,
  dailySpendingLimitPaise: 30000, // ₹300 / day
  weeklyBudgetPaise: 200000, // ₹2,000 / week
  theme: 'system',
  currency: 'INR',
  timezone: 'Asia/Kolkata',
  activeModules: {
    fitnessAndHabits: true,
    academics: true,
    onlineEarnings: true,
    loans: true,
    goals: true,
  },
  fitnessToggles: {
    water: true,
    sleep: true,
    workout: true,
    steps: true,
    weight: false, // off by default
  },
  widgetOrder: [
    'balance_summary',
    'cash_flow',
    'budget_progress',
    'earnings_glance',
    'today_tasks',
    'habit_tracker',
    'goals_snapshot',
    'recent_transactions',
  ],
  widgetVisibility: {
    balance_summary: true,
    cash_flow: true,
    budget_progress: true,
    earnings_glance: true,
    today_tasks: true,
    habit_tracker: true,
    goals_snapshot: true,
    recent_transactions: true,
  },
  hasSeenOnboarding: false,
};

/**
 * Ensures system settings exist on first launch.
 */
export async function initializeDatabaseDefaults(): Promise<void> {
  const existingSettings = await db.settings.get('current_user_settings');
  if (!existingSettings) {
    await db.settings.put(DEFAULT_USER_SETTINGS);
  }
}

/**
 * Loads realistic sample data for previewing LifeOS.
 * All sample items have notes containing "[DEMO SAMPLE DATA]" so they are clearly marked.
 */
export async function loadSampleData(): Promise<void> {
  const now = new Date().toISOString();
  const todayStr = now.slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  // 1. Budget
  const sampleBudgets: Budget[] = [
    {
      id: 'demo_b_total',
      category: 'total',
      month: currentMonthStr,
      amountPaise: 800000, // ₹8,000
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo_b_food',
      category: 'Food & Canteen',
      month: currentMonthStr,
      amountPaise: 350000, // ₹3,500
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'demo_b_books',
      category: 'Books & Stationery',
      month: currentMonthStr,
      amountPaise: 150000, // ₹1,500
      createdAt: now,
      updatedAt: now,
    },
  ];

  // 2. Sample Transactions
  const sampleTransactions: Transaction[] = [
    {
      id: 'demo_tx_allowance',
      type: 'income',
      date: `${currentMonthStr}-01`,
      title: 'Monthly Allowance [DEMO SAMPLE DATA]',
      accountId: 'acc_bank_sbi',
      amountPaise: 800000,
      category: 'Allowance',
      notes: '[DEMO SAMPLE DATA] Monthly transfer from family',
      tags: ['allowance', 'demo'],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'demo_tx_mess',
      type: 'expense',
      date: `${currentMonthStr}-03`,
      title: 'Canteen Monthly Pass [DEMO SAMPLE DATA]',
      accountId: 'acc_bank_sbi',
      amountPaise: 220000,
      category: 'Food & Canteen',
      notes: '[DEMO SAMPLE DATA]',
      tags: ['mess', 'food'],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'demo_tx_books',
      type: 'expense',
      date: `${currentMonthStr}-08`,
      title: 'Data Structures Textbook [DEMO SAMPLE DATA]',
      accountId: 'acc_cash_wallet',
      amountPaise: 65000,
      category: 'Books & Stationery',
      notes: '[DEMO SAMPLE DATA]',
      tags: ['college'],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
    {
      id: 'demo_tx_chai',
      type: 'expense',
      date: todayStr,
      title: 'Tea & Samosa at Campus stall [DEMO SAMPLE DATA]',
      accountId: 'acc_cash_wallet',
      amountPaise: 4000,
      category: 'Snacks & Chai',
      notes: '[DEMO SAMPLE DATA]',
      tags: ['tea'],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    },
  ];

  // 3. Online Platform & Earnings
  const samplePlatform: Platform = {
    id: 'demo_plat_upwork',
    name: 'Upwork Freelancing [DEMO SAMPLE DATA]',
    websiteUrl: 'https://upwork.com',
    category: 'Freelancing',
    defaultCurrency: 'USD',
    withdrawalMinimumPaise: 800000, // ₹8,000 ($100)
    trustStatus: 'user_verified',
    trustNotes: 'Received direct wire to SBI account previously.',
    scamChecklist: {
      upfrontFeesDemanded: false,
      unrealisticReturns: false,
      noClearPayoutProof: false,
      requestsSensitiveCredentials: false,
      referralPyramidStructure: false,
      noCompanyInformation: false,
      risingWithdrawalMinimum: false,
      unresponsiveSupport: false,
    },
    withdrawableBalanceReportedPaise: 450000, // ₹4,500
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  const sampleEarning: EarningRecord = {
    id: 'demo_earning_1',
    platformId: 'demo_plat_upwork',
    date: `${currentMonthStr}-10`,
    title: 'Python Web Scraping Project [DEMO SAMPLE DATA]',
    amountMinorUnits: 5000, // $50.00
    currency: 'USD',
    exchangeRateToInr: 83.5,
    exchangeRateDate: `${currentMonthStr}-10`,
    inrAmountPaise: 417500, // ₹4,175
    classification: 'verified',
    evidenceNote: 'Contract closed with 5-star review [DEMO SAMPLE DATA]',
    allocatedToWithdrawalPaise: 0,
    auditTrail: [],
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  // 4. Academics
  const sampleSubject: Subject = {
    id: 'demo_sub_cs301',
    code: 'CS301',
    name: 'Operating Systems & Concurrency [DEMO SAMPLE DATA]',
    instructor: 'Dr. Sharma',
    credits: 4,
    color: '#3b82f6',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  const sampleTask: AcademicTask = {
    id: 'demo_task_lab',
    subjectId: 'demo_sub_cs301',
    title: 'OS Lab 4: Semaphore Implementation [DEMO SAMPLE DATA]',
    type: 'lab_record',
    dueDate: todayStr,
    priority: 'urgent',
    estimatedMinutes: 90,
    status: 'in_progress',
    notes: 'Write analysis report on race conditions [DEMO SAMPLE DATA]',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  // 5. Habits
  const sampleHabit: Habit = {
    id: 'demo_habit_study',
    name: 'Daily 2-hr Deep Study [DEMO SAMPLE DATA]',
    category: 'study',
    frequency: 'daily',
    color: '#8b5cf6',
    isArchived: false,
    createdAt: now,
    updatedAt: now,
  };

  const sampleHabitLogs: HabitLog[] = [
    { id: 'demo_hl_1', habitId: 'demo_habit_study', date: todayStr, completed: true },
  ];

  // 6. Goals
  const sampleGoal: Goal = {
    id: 'demo_goal_cgpa',
    title: 'Score 8.5+ CGPA this Semester [DEMO SAMPLE DATA]',
    category: 'academic',
    targetDate: `${currentMonthStr}-28`,
    status: 'active',
    progressPercent: 65,
    measurableTarget: '8.5 CGPA',
    currentValue: '8.2 CGPA',
    steps: [
      { id: 's1', title: 'Finish OS Lab Records', isCompleted: true },
      { id: 's2', title: 'Prepare Formula Sheet for Mid-Terms', isCompleted: false },
    ],
    notes: '[DEMO SAMPLE DATA]',
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };

  // Save to Dexie
  await db.budgets.bulkPut(sampleBudgets);
  await db.transactions.bulkPut(sampleTransactions);
  await db.platforms.put(samplePlatform);
  await db.earningRecords.put(sampleEarning);
  await db.subjects.put(sampleSubject);
  await db.academicTasks.put(sampleTask);
  await db.habits.put(sampleHabit);
  await db.habitLogs.bulkPut(sampleHabitLogs);
  await db.goals.put(sampleGoal);
}

/**
 * Reversibly removes all sample demo data without touching user's own data.
 */
export async function removeSampleData(): Promise<void> {
  await db.budgets.where('id').startsWith('demo_').delete();
  await db.transactions.where('id').startsWith('demo_').delete();
  await db.platforms.where('id').startsWith('demo_').delete();
  await db.earningRecords.where('id').startsWith('demo_').delete();
  await db.subjects.where('id').startsWith('demo_').delete();
  await db.academicTasks.where('id').startsWith('demo_').delete();
  await db.habits.where('id').startsWith('demo_').delete();
  await db.habitLogs.where('id').startsWith('demo_').delete();
  await db.goals.where('id').startsWith('demo_').delete();
}
