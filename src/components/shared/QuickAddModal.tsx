import React, { useState, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Tabs } from '../ui/Tabs';
import { Button } from '../ui/Button';
import { Input, Select, Textarea } from '../ui/Input';
import { useToast } from '../ui/Toast';
import { useAuth } from '../../context/AuthContext';
import { useUserData } from '../../hooks/useUserData';
import { db } from '../../db/db';
import { rupeesToPaise, convertForeignToInrPaise } from '../../domain/money';
import { checkDuplicateTransaction } from '../../domain/transactions';
import {
  ExpenseTransactionSchema,
  TransferTransactionSchema,
  EarningRecordSchema,
  AcademicTaskSchema,
  Transaction,
  EarningRecord,
  AcademicTask,
} from '../../domain/types';
import { AlertCircle, ArrowRightLeft, Briefcase, DollarSign, BookOpen } from 'lucide-react';

export interface QuickAddModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'expense' | 'earning' | 'task' | 'transfer';
}

export function QuickAddModal({
  isOpen,
  onClose,
  defaultTab = 'expense',
}: QuickAddModalProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);
  const { success, error } = useToast();
  const { currentUser } = useAuth();
  const {
    accounts: liveAccounts,
    platforms,
    subjects: liveSubjects,
    transactions: existingTransactions,
    settings,
  } = useUserData();

  const accounts = liveAccounts.filter(a => !a.isArchived);
  const subjects = liveSubjects.filter(s => !s.isArchived);

  const todayStr = new Date().toISOString().slice(0, 10);

  // Form states: Expense
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState('Food & Canteen');
  const [expenseAccountId, setExpenseAccountId] = useState('');
  const [expenseDate, setExpenseDate] = useState(todayStr);
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseDupWarning, setExpenseDupWarning] = useState(false);

  // Form states: Transfer
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferFee, setTransferFee] = useState('0');
  const [transferDate, setTransferDate] = useState(todayStr);
  const [transferNotes, setTransferNotes] = useState('');

  // Form states: Earning Record
  const [earningPlatformId, setEarningPlatformId] = useState('');
  const [earningTitle, setEarningTitle] = useState('');
  const [earningAmount, setEarningAmount] = useState('');
  const [earningCurrency, setEarningCurrency] = useState('INR');
  const [earningFxRate, setEarningFxRate] = useState('1');
  const [earningClassification, setEarningClassification] = useState<'verified' | 'uncertain'>('verified');
  const [earningConfidence, setEarningConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [earningReason, setEarningReason] = useState('');
  const [earningReviewDate, setEarningReviewDate] = useState(todayStr);
  const [earningEvidence, setEarningEvidence] = useState('');
  const [earningDate, setEarningDate] = useState(todayStr);

  // Form states: Academic Task
  const [taskSubjectId, setTaskSubjectId] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskType, setTaskType] = useState<any>('assignment');
  const [taskDueDate, setTaskDueDate] = useState(todayStr);
  const [taskPriority, setTaskPriority] = useState<any>('medium');
  const [taskMinutes, setTaskMinutes] = useState('60');

  // Available categories from user settings, falling back to clean suggestions
  const availableCategories = useMemo(() => {
    if (settings?.customCategories && settings.customCategories.length > 0) {
      return settings.customCategories;
    }
    return ['General', 'Food & Canteen', 'Books & Stationery', 'Transport & Metro', 'Miscellaneous'];
  }, [settings?.customCategories]);

  // Handle saving Expense
  const handleSaveExpense = async (forceSave = false) => {
    const targetAccountId = expenseAccountId || accounts[0]?.id;
    if (!targetAccountId) {
      error('Account required', 'Please add an account in Finance first before recording an expense.');
      return;
    }

    const amountPaise = rupeesToPaise(expenseAmount);

    if (!forceSave) {
      const dup = checkDuplicateTransaction(
        { amountPaise, date: expenseDate, accountId: targetAccountId, title: expenseTitle },
        existingTransactions
      );
      if (dup.isDuplicate) {
        setExpenseDupWarning(true);
        return;
      }
    }

    const now = new Date().toISOString();
    const candidate = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      type: 'expense' as const,
      date: expenseDate,
      title: expenseTitle,
      accountId: targetAccountId,
      amountPaise,
      category: expenseCategory || availableCategories[0],
      notes: expenseNotes,
      tags: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
      isAutoGenerated: false,
    };

    const parsed = ExpenseTransactionSchema.safeParse(candidate);
    if (!parsed.success) {
      error('Validation error', parsed.error.issues[0]?.message);
      return;
    }

    await db.transactions.add(parsed.data);
    success('Expense recorded', `${expenseTitle} (-₹${(amountPaise / 100).toFixed(2)})`);
    resetForms();
    onClose();
  };

  // Handle saving Transfer
  const handleSaveTransfer = async () => {
    const effectiveFromId = transferFromId || accounts[0]?.id;
    const effectiveToId = transferToId || (accounts.length > 1 ? accounts[1]?.id : accounts[0]?.id);

    if (!effectiveFromId || !effectiveToId || effectiveFromId === effectiveToId) {
      error('Invalid transfer', 'Source and destination accounts must be different');
      return;
    }

    const amountPaise = rupeesToPaise(transferAmount);
    const feePaise = rupeesToPaise(transferFee);
    const now = new Date().toISOString();

    const candidate = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      type: 'transfer' as const,
      date: transferDate,
      title: `Transfer to ${accounts.find(a => a.id === effectiveToId)?.name || 'Account'}`,
      fromAccountId: effectiveFromId,
      toAccountId: effectiveToId,
      amountPaise,
      feePaise,
      notes: transferNotes,
      tags: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const parsed = TransferTransactionSchema.safeParse(candidate);
    if (!parsed.success) {
      error('Validation error', parsed.error.issues[0]?.message);
      return;
    }

    await db.transactions.add(parsed.data as Transaction);
    success('Transfer completed', `₹${(amountPaise / 100).toFixed(2)} moved successfully`);
    resetForms();
    onClose();
  };

  // Handle saving Earning Record
  const handleSaveEarning = async () => {
    const targetPlatformId = earningPlatformId || platforms[0]?.id;
    if (!targetPlatformId) {
      error('Platform required', 'Please add an earning platform first before recording earnings.');
      return;
    }

    const rawUnits = Math.round(parseFloat(earningAmount || '0') * 100);
    const rate = parseFloat(earningFxRate || '1');
    const inrPaise = earningCurrency === 'INR' ? rawUnits : convertForeignToInrPaise(rawUnits, rate);
    const now = new Date().toISOString();

    const candidate: any = {
      id: `earn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      platformId: targetPlatformId,
      date: earningDate,
      title: earningTitle,
      amountMinorUnits: rawUnits,
      currency: earningCurrency,
      exchangeRateToInr: rate,
      exchangeRateDate: earningDate,
      inrAmountPaise: inrPaise,
      classification: earningClassification,
      confidenceLevel: earningClassification === 'uncertain' ? earningConfidence : undefined,
      reasonForUncertainty: earningClassification === 'uncertain' ? earningReason : undefined,
      reviewDate: earningClassification === 'uncertain' ? earningReviewDate : undefined,
      evidenceNote: earningEvidence,
      allocatedToWithdrawalPaise: 0,
      auditTrail: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const parsed = EarningRecordSchema.safeParse(candidate);
    if (!parsed.success) {
      error('Validation error', parsed.error.issues[0]?.message);
      return;
    }

    await db.earningRecords.add(parsed.data as EarningRecord);
    success(
      'Earning record saved',
      `${earningTitle} (${earningClassification === 'verified' ? 'Verified pending' : 'Uncertain'})`
    );
    resetForms();
    onClose();
  };

  // Handle saving Academic Task
  const handleSaveTask = async () => {
    const targetSubjectId = taskSubjectId || subjects[0]?.id;
    if (!targetSubjectId) {
      error('Course required', 'Please add a course first in Academics before creating a task.');
      return;
    }

    const now = new Date().toISOString();
    const candidate = {
      id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      subjectId: targetSubjectId,
      title: taskTitle,
      type: taskType,
      dueDate: taskDueDate,
      priority: taskPriority,
      estimatedMinutes: parseInt(taskMinutes) || 60,
      status: 'todo' as const,
      notes: '',
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    const parsed = AcademicTaskSchema.safeParse(candidate);
    if (!parsed.success) {
      error('Validation error', parsed.error.issues[0]?.message);
      return;
    }

    await db.academicTasks.add(parsed.data as AcademicTask);
    success('Academic task added', `${taskTitle} (Due ${taskDueDate})`);
    resetForms();
    onClose();
  };

  const resetForms = () => {
    setExpenseTitle('');
    setExpenseAmount('');
    setExpenseNotes('');
    setExpenseDupWarning(false);
    setTransferAmount('');
    setTransferFee('0');
    setTransferNotes('');
    setEarningTitle('');
    setEarningAmount('');
    setEarningEvidence('');
    setEarningReason('');
    setTaskTitle('');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Quick Action" maxWidth="lg">
      <Tabs
        activeTab={activeTab}
        onChange={setActiveTab}
        tabs={[
          { id: 'expense', label: 'Expense', icon: <DollarSign className="w-3.5 h-3.5" /> },
          { id: 'earning', label: 'Earning Record', icon: <Briefcase className="w-3.5 h-3.5" /> },
          { id: 'task', label: 'Academic Task', icon: <BookOpen className="w-3.5 h-3.5" /> },
          { id: 'transfer', label: 'Account Transfer', icon: <ArrowRightLeft className="w-3.5 h-3.5" /> },
        ]}
        className="mb-4"
      />

      {/* TAB 1: EXPENSE */}
      {activeTab === 'expense' && (
        <div className="space-y-3.5">
          {expenseDupWarning && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-700 dark:text-amber-300 flex-1">
                <p className="font-semibold">Possible duplicate detected</p>
                <p>A transaction with the exact same title, amount, and date already exists.</p>
                <div className="mt-2 flex space-x-2">
                  <Button size="sm" variant="outline" onClick={() => handleSaveExpense(true)}>
                    Save Anyway
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setExpenseDupWarning(false)}>
                    Review Details
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Title"
              placeholder="e.g. Canteen Lunch, Metro Recharge"
              value={expenseTitle}
              onChange={e => setExpenseTitle(e.target.value)}
            />
            <Input
              label="Amount (₹)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={expenseAmount}
              onChange={e => setExpenseAmount(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select
              label="Account"
              value={expenseAccountId || accounts[0]?.id || ''}
              onChange={e => setExpenseAccountId(e.target.value)}
            >
              {accounts.length === 0 ? (
                <option value="">No accounts available</option>
              ) : (
                accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))
              )}
            </Select>

            <Select
              label="Category"
              value={expenseCategory || availableCategories[0]}
              onChange={e => setExpenseCategory(e.target.value)}
            >
              {availableCategories.map((cat: string) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>

            <Input
              label="Date"
              type="date"
              value={expenseDate}
              onChange={e => setExpenseDate(e.target.value)}
            />
          </div>

          <Textarea
            label="Notes (Optional)"
            placeholder="Add context or tags"
            value={expenseNotes}
            onChange={e => setExpenseNotes(e.target.value)}
          />

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={() => handleSaveExpense(false)}
              disabled={!expenseTitle || !expenseAmount || accounts.length === 0}
            >
              Record Expense
            </Button>
          </div>
        </div>
      )}

      {/* TAB 2: ONLINE EARNING RECORD */}
      {activeTab === 'earning' && (
        <div className="space-y-3.5">
          {platforms.length === 0 && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
              No earning platforms registered. Please add a platform first in Online Earnings.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Platform"
              value={earningPlatformId || platforms[0]?.id || ''}
              onChange={e => setEarningPlatformId(e.target.value)}
            >
              {platforms.length === 0 ? (
                <option value="">No platforms available</option>
              ) : (
                platforms.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.category})
                  </option>
                ))
              )}
            </Select>

            <Input
              label="Task / Project Title"
              placeholder="e.g. Frontend Bugfix, Data Annotation"
              value={earningTitle}
              onChange={e => setEarningTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label={`Amount (${earningCurrency})`}
              type="number"
              step="0.01"
              placeholder="0.00"
              value={earningAmount}
              onChange={e => setEarningAmount(e.target.value)}
            />

            <Select
              label="Currency"
              value={earningCurrency}
              onChange={e => {
                setEarningCurrency(e.target.value);
                if (e.target.value === 'INR') setEarningFxRate('1');
              }}
            >
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="CAD">CAD ($)</option>
            </Select>

            {earningCurrency !== 'INR' ? (
              <Input
                label="Exchange Rate to INR"
                type="number"
                step="0.01"
                placeholder="e.g. 83.50"
                value={earningFxRate}
                onChange={e => setEarningFxRate(e.target.value)}
              />
            ) : (
              <Input
                label="Date"
                type="date"
                value={earningDate}
                onChange={e => setEarningDate(e.target.value)}
              />
            )}
          </div>

          {/* REQUIRED CLASSIFICATION */}
          <div className="p-3 rounded-lg border border-border bg-muted/20 space-y-3">
            <label className="block text-xs font-semibold text-foreground">
              Classification (Mandatory) <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all ${
                  earningClassification === 'verified'
                    ? 'border-emerald-500 bg-emerald-500/10 text-foreground'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="classification"
                  className="mt-0.5 mr-2"
                  checked={earningClassification === 'verified'}
                  onChange={() => setEarningClassification('verified')}
                />
                <div>
                  <p className="text-xs font-semibold">Verified</p>
                  <p className="text-[11px] text-muted-foreground">
                    Reliable proof / invoice / receipt held.
                  </p>
                </div>
              </label>

              <label
                className={`flex items-start p-2.5 rounded-lg border cursor-pointer transition-all ${
                  earningClassification === 'uncertain'
                    ? 'border-amber-500 bg-amber-500/10 text-foreground'
                    : 'border-border bg-card hover:bg-muted/50'
                }`}
              >
                <input
                  type="radio"
                  name="classification"
                  className="mt-0.5 mr-2"
                  checked={earningClassification === 'uncertain'}
                  onChange={() => setEarningClassification('uncertain')}
                />
                <div>
                  <p className="text-xs font-semibold">Uncertain</p>
                  <p className="text-[11px] text-muted-foreground">
                    Pending audit, unreviewed or question mark.
                  </p>
                </div>
              </label>
            </div>

            {earningClassification === 'verified' ? (
              <Input
                label="Evidence Note (screenshot, txn ID, receipt ref)"
                placeholder="e.g. Upwork Contract #12938 completed"
                value={earningEvidence}
                onChange={e => setEarningEvidence(e.target.value)}
              />
            ) : (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <Select
                    label="Confidence Level"
                    value={earningConfidence}
                    onChange={e => setEarningConfidence(e.target.value as any)}
                  >
                    <option value="low">Low Confidence</option>
                    <option value="medium">Medium Confidence</option>
                    <option value="high">High Confidence</option>
                  </Select>
                  <Input
                    label="Follow-up Review Date"
                    type="date"
                    value={earningReviewDate}
                    onChange={e => setEarningReviewDate(e.target.value)}
                  />
                </div>
                <Input
                  label="Reason for Uncertainty"
                  placeholder="e.g. Client review pending, platform clearance hold"
                  value={earningReason}
                  onChange={e => setEarningReason(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveEarning}
              disabled={
                !earningTitle ||
                !earningAmount ||
                (earningClassification === 'uncertain' && (!earningReason || !earningReviewDate))
              }
            >
              Add Earning Record
            </Button>
          </div>
        </div>
      )}

      {/* TAB 3: ACADEMIC TASK */}
      {activeTab === 'task' && (
        <div className="space-y-3.5">
          {subjects.length === 0 && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
              No courses registered. Please add a course first in Academics.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Subject / Course"
              value={taskSubjectId || subjects[0]?.id || ''}
              onChange={e => setTaskSubjectId(e.target.value)}
            >
              {subjects.length === 0 ? (
                <option value="">No courses available</option>
              ) : (
                subjects.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.code}: {s.name}
                  </option>
                ))
              )}
            </Select>

            <Input
              label="Task Title"
              placeholder="e.g. Lab 3 Report, Problem Sheet 2"
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select label="Type" value={taskType} onChange={e => setTaskType(e.target.value)}>
              <option value="assignment">Assignment</option>
              <option value="lab_record">Lab Record</option>
              <option value="exam_internal">Exam / Midterm</option>
              <option value="project">Project Work</option>
              <option value="viva_prep">Viva Prep</option>
              <option value="study_session">Study Session</option>
            </Select>

            <Input
              label="Due Date"
              type="date"
              value={taskDueDate}
              onChange={e => setTaskDueDate(e.target.value)}
            />

            <Select
              label="Priority"
              value={taskPriority}
              onChange={e => setTaskPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>

          <Input
            label="Estimated Time (Minutes)"
            type="number"
            value={taskMinutes}
            onChange={e => setTaskMinutes(e.target.value)}
          />

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSaveTask} disabled={!taskTitle || subjects.length === 0}>
              Create Task
            </Button>
          </div>
        </div>
      )}

      {/* TAB 4: TRANSFER */}
      {activeTab === 'transfer' && (
        <div className="space-y-3.5">
          {accounts.length < 2 && (
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-700 dark:text-amber-300">
              Transfers require at least two accounts. Please create additional accounts in Finance first.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="From Account"
              value={transferFromId || accounts[0]?.id || ''}
              onChange={e => setTransferFromId(e.target.value)}
            >
              {accounts.length === 0 ? (
                <option value="">No accounts available</option>
              ) : (
                accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))
              )}
            </Select>

            <Select
              label="To Account"
              value={transferToId || accounts[1]?.id || ''}
              onChange={e => setTransferToId(e.target.value)}
            >
              {accounts.length === 0 ? (
                <option value="">No accounts available</option>
              ) : (
                accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.type})
                  </option>
                ))
              )}
            </Select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Input
              label="Transfer Amount (₹)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={transferAmount}
              onChange={e => setTransferAmount(e.target.value)}
            />

            <Input
              label="Transfer Fee (₹)"
              type="number"
              step="0.01"
              value={transferFee}
              onChange={e => setTransferFee(e.target.value)}
            />

            <Input
              label="Date"
              type="date"
              value={transferDate}
              onChange={e => setTransferDate(e.target.value)}
            />
          </div>

          <Textarea
            label="Notes (Optional)"
            placeholder="e.g. ATM withdrawal, UPI bank top-up"
            value={transferNotes}
            onChange={e => setTransferNotes(e.target.value)}
          />

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveTransfer}
              disabled={
                !transferAmount ||
                accounts.length < 2 ||
                (transferFromId || accounts[0]?.id) === (transferToId || (accounts.length > 1 ? accounts[1]?.id : accounts[0]?.id))
              }
            >
              Execute Transfer
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
