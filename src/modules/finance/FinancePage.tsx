import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import {
  Account,
  Transaction,
  SavingsGoal,
  RecurringTransaction,
  LoanTransaction,
  AdjustmentTransaction,
  TransferTransaction,
  EarningPayoutTransaction,
} from '../../domain/types';
import { revertRecordAllocations } from '../../domain/earnings';
import {
  deriveAccountBalance,
  deriveAllAccountBalances,
  calculateDashboardBalances,
  calculateReconciliationDelta,
} from '../../domain/balances';
import {
  calculateIncomeExpense,
  groupExpensesByCategory,
} from '../../domain/transactions';
import { calculateLoansSummary, calculateNetWorth } from '../../domain/loans';
import { rupeesToPaise, paiseToRupees } from '../../domain/money';
import { SUGGESTED_STUDENT_CATEGORIES } from '../../db/seed';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Tabs } from '../../components/ui/Tabs';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { EmptyState } from '../../components/shared/EmptyState';
import { MoneyDisplay } from '../../components/shared/MoneyDisplay';
import { useToast } from '../../components/ui/Toast';
import {
  Wallet,
  Smartphone,
  Banknote,
  Plus,
  ArrowRightLeft,
  SlidersHorizontal,
  Clock,
  Users,
  Search,
  Filter,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { useUserData } from '../../hooks/useUserData';

export function FinancePage() {
  const [activeTab, setActiveTab] = useState<'overview' | 'ledger' | 'loans' | 'recurring' | 'savings'>('overview');
  const { success, error, toastWithUndo } = useToast();

  const {
    currentUser,
    accounts,
    transactions,
    savingsGoals,
    recurringTransactions: recurringSchedules,
    settings,
  } = useUserData();

  const todayStr = new Date().toISOString().slice(0, 10);
  const currentMonthStr = todayStr.slice(0, 7);

  // Derived Account Balances & Summaries
  const balancesMap = useMemo(() => deriveAllAccountBalances(accounts, transactions), [accounts, transactions]);
  const dashboardBalances = useMemo(() => calculateDashboardBalances(accounts, transactions), [accounts, transactions]);
  const loanTxs = useMemo(() => transactions.filter(t => t.type.startsWith('loan_')) as LoanTransaction[], [transactions]);
  const loansSummary = useMemo(() => calculateLoansSummary(loanTxs, todayStr), [loanTxs, todayStr]);
  const netWorth = useMemo(() => calculateNetWorth(dashboardBalances.totalLiquidPaise, loansSummary), [dashboardBalances, loansSummary]);

  // Modal Dialogs
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isReconcileOpen, setIsReconcileOpen] = useState(false);
  const [reconcileAccount, setReconcileAccount] = useState<Account | null>(null);
  const [reconcileStatedAmount, setReconcileStatedAmount] = useState('');
  const [reconcileReason, setReconcileReason] = useState('');

  // Account creation form
  const [newAccName, setNewAccName] = useState('');
  const [newAccType, setNewAccType] = useState<any>('upi');
  const [newAccOpening, setNewAccOpening] = useState('0');
  const [newAccExcludeSpendable, setNewAccExcludeSpendable] = useState(false);

  // Loan creation form
  const [isAddLoanOpen, setIsAddLoanOpen] = useState(false);
  const [loanPerson, setLoanPerson] = useState('');
  const [loanType, setLoanType] = useState<any>('loan_given');
  const [loanAmount, setLoanAmount] = useState('');
  const [loanAccountId, setLoanAccountId] = useState('');
  const [loanDueDate, setLoanDueDate] = useState('');
  const [loanNotes, setLoanNotes] = useState('');

  // Delete transaction confirmation
  const [deletingTx, setDeletingTx] = useState<Transaction | null>(null);

  // Ledger Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterAccount, setFilterAccount] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(t => !t.deletedAt)
      .filter(t => {
        if (filterType !== 'all' && t.type !== filterType) return false;
        if (filterAccount !== 'all') {
          if ('accountId' in t && t.accountId !== filterAccount) return false;
          if (t.type === 'transfer' && t.fromAccountId !== filterAccount && t.toAccountId !== filterAccount) return false;
        }
        if (filterCategory !== 'all' && 'category' in t && t.category !== filterCategory) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchTitle = t.title.toLowerCase().includes(q);
          const matchNotes = t.notes?.toLowerCase().includes(q);
          const matchCat = 'category' in t && t.category.toLowerCase().includes(q);
          if (!matchTitle && !matchNotes && !matchCat) return false;
        }
        return true;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, filterType, filterAccount, filterCategory, searchQuery]);

  // Handle Account Creation
  const handleCreateAccount = async () => {
    if (!newAccName.trim()) {
      error('Name required', 'Please provide an account name.');
      return;
    }
    const now = new Date().toISOString();
    const newAcc: Account = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      name: newAccName.trim(),
      type: newAccType,
      currency: 'INR',
      openingBalancePaise: rupeesToPaise(newAccOpening),
      isExcludedFromSpendable: newAccExcludeSpendable,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };
    await db.accounts.add(newAcc);
    success('Account created', `${newAcc.name} added.`);
    setIsAddAccountOpen(false);
    setNewAccName('');
    setNewAccOpening('0');
    setNewAccExcludeSpendable(false);
  };

  // Handle Manual Reconciliation Adjustment
  const handleReconcile = async () => {
    if (!reconcileAccount) return;
    const computedPaise = balancesMap[reconcileAccount.id] ?? 0;
    const statedPaise = rupeesToPaise(reconcileStatedAmount);
    const deltaPaise = calculateReconciliationDelta(statedPaise, computedPaise);

    if (deltaPaise === 0) {
      error('Balances match', 'The entered balance is identical to the computed balance.');
      return;
    }
    if (!reconcileReason.trim()) {
      error('Reason required', 'Please explain why the balance is being adjusted.');
      return;
    }

    const now = new Date().toISOString();
    const adjTx: AdjustmentTransaction = {
      id: `adj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      type: 'adjustment',
      date: todayStr,
      title: `Reconciliation Adjustment (${reconcileAccount.name})`,
      accountId: reconcileAccount.id,
      deltaPaise,
      statedBalancePaise: statedPaise,
      computedBalancePaise: computedPaise,
      reason: reconcileReason.trim(),
      notes: `Manual adjustment from ₹${(computedPaise / 100).toFixed(2)} to ₹${(statedPaise / 100).toFixed(2)}: ${reconcileReason.trim()}`,
      tags: ['reconciliation'],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.transactions.add(adjTx);
    success(
      'Account Reconciled',
      `Adjustment of ${deltaPaise > 0 ? '+' : ''}₹${(deltaPaise / 100).toFixed(2)} recorded.`
    );
    setIsReconcileOpen(false);
    setReconcileAccount(null);
    setReconcileStatedAmount('');
    setReconcileReason('');
  };

  // Handle Soft Deletion of Transaction with Undo Toast
  const handleDeleteTransaction = async (tx: Transaction) => {
    const now = new Date().toISOString();

    if (tx.type === 'earning_payout') {
      const payoutTx = tx as EarningPayoutTransaction;
      if (payoutTx.withdrawalId) {
        const w = await db.withdrawals.get(payoutTx.withdrawalId);
        if (w && w.allocations) {
          const allRecords = await db.earningRecords.toArray();
          const restored = revertRecordAllocations(
            allRecords,
            w.allocations.map(a => ({ earningRecordId: a.earningRecordId, amountPaise: a.allocatedPaise }))
          );
          await db.transaction('rw', [db.transactions, db.withdrawals, db.earningRecords], async () => {
            await db.transactions.update(tx.id, { deletedAt: now });
            await db.withdrawals.update(w.id, { status: 'requested', payoutTransactionId: undefined, updatedAt: now });
            for (const r of restored) {
              await db.earningRecords.put(r);
            }
          });
        } else {
          await db.transactions.update(tx.id, { deletedAt: now });
        }
      } else {
        await db.transactions.update(tx.id, { deletedAt: now });
      }
    } else {
      await db.transactions.update(tx.id, { deletedAt: now });
    }

    toastWithUndo(`Deleted "${tx.title}"`, async () => {
      await db.transactions.update(tx.id, { deletedAt: null });
      success('Restored transaction', `"${tx.title}" restored.`);
    });

    setDeletingTx(null);
  };

  // Handle Adding Loan
  const handleCreateLoan = async () => {
    if (!loanPerson.trim() || !loanAmount) {
      error('Incomplete form', 'Person name and amount are required.');
      return;
    }
    const accId = loanAccountId || accounts[0]?.id;
    if (!accId) {
      error('Account required', 'Please select an account.');
      return;
    }

    const amountPaise = rupeesToPaise(loanAmount);
    const now = new Date().toISOString();

    const titleMap: Record<string, string> = {
      loan_given: `Lent money to ${loanPerson.trim()}`,
      loan_received: `Borrowed money from ${loanPerson.trim()}`,
      loan_repayment_in: `Repayment received from ${loanPerson.trim()}`,
      loan_repayment_out: `Repaid money to ${loanPerson.trim()}`,
    };

    const loanTx: LoanTransaction = {
      id: `loan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      type: loanType,
      date: todayStr,
      title: titleMap[loanType] || `Loan with ${loanPerson.trim()}`,
      accountId: accId,
      amountPaise,
      personName: loanPerson.trim(),
      dueDate: loanDueDate || undefined,
      notes: loanNotes,
      tags: ['loan', loanPerson.trim().toLowerCase()],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.transactions.add(loanTx);
    success('Loan record added', `${titleMap[loanType]} (₹${(amountPaise / 100).toFixed(2)})`);
    setIsAddLoanOpen(false);
    setLoanPerson('');
    setLoanAmount('');
    setLoanDueDate('');
    setLoanNotes('');
  };

  const handleAddSuggestedCategories = async () => {
    if (!settings) return;
    const currentCats = settings.customCategories || [];
    const merged = Array.from(new Set([...currentCats, ...SUGGESTED_STUDENT_CATEGORIES]));
    await db.settings.update(settings.id, { customCategories: merged });
    success('Categories Added', `Added ${SUGGESTED_STUDENT_CATEGORIES.length} suggested student categories.`);
  };

  const expenseCategories = useMemo(() => {
    return groupExpensesByCategory(transactions, {
      startDate: `${currentMonthStr}-01`,
      endDate: `${currentMonthStr}-31`,
    });
  }, [transactions, currentMonthStr]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#64748b'];

  return (
    <div className="space-y-6">
      {/* Top Banner / Headline */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Finance Command</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Strict double-entry ledger • Derived balances • Personal Finance Tracker
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => setIsAddAccountOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            New Account
          </Button>
          <Button size="sm" onClick={() => setIsAddLoanOpen(true)}>
            <Users className="w-3.5 h-3.5 mr-1.5" />
            Record Loan
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={t => setActiveTab(t as any)}
        tabs={[
          { id: 'overview', label: 'Accounts & Net Worth', icon: <Wallet className="w-4 h-4" /> },
          { id: 'ledger', label: 'Transaction Ledger', icon: <SlidersHorizontal className="w-4 h-4" />, badge: filteredTransactions.length },
          { id: 'loans', label: 'Loans & Repayments', icon: <Users className="w-4 h-4" />, badge: loansSummary.personSummaries.length },
          { id: 'recurring', label: 'Recurring & Bills', icon: <Clock className="w-4 h-4" />, badge: recurringSchedules.filter(r => r.isActive).length },
        ]}
      />

      {/* TAB 1: ACCOUNTS & OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6 animate-fade-in">
          {/* Dashboard Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Spendable Money</span>
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <div className="text-lg font-bold">
                  <MoneyDisplay paise={dashboardBalances.totalSpendablePaise} colorScheme="neutral" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Available for daily spending</p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Physical Cash</span>
                  <Banknote className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="text-lg font-bold">
                  <MoneyDisplay paise={dashboardBalances.cashPaise} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Cash in wallet & drawer</p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider">UPI</span>
                  <Smartphone className="w-4 h-4 text-sky-500" />
                </div>
                <div className="text-lg font-bold">
                  <MoneyDisplay paise={dashboardBalances.upiDigitalPaise} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">UPI & linked accounts</p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-muted-foreground mb-1.5">
                  <span className="text-[11px] font-medium uppercase tracking-wider">Net Worth</span>
                  <ShieldAlert className="w-4 h-4 text-purple-500" />
                </div>
                <div className="text-lg font-bold">
                  <MoneyDisplay paise={netWorth.netWorthPaise} colorScheme="auto" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Assets - Liabilities (excl. uncertain)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Accounts List & Derived Balance Inspection */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Your Accounts</h3>
                <span className="text-xs text-muted-foreground">Derived strictly from opening balance + ledger</span>
              </div>

              <div className="space-y-2.5">
                {accounts.filter(a => !a.deletedAt).length === 0 ? (
                  <EmptyState
                    icon={<Wallet className="w-6 h-6" />}
                    title="No accounts created yet"
                    description="Add your first physical cash, UPI account, or digital wallet to start tracking spendable money."
                    actionLabel="Add First Account"
                    onAction={() => {
                      setNewAccName('');
                      setNewAccOpening('');
                      setIsAddAccountOpen(true);
                    }}
                  />
                ) : (
                  accounts.filter(a => !a.deletedAt).map(acc => {
                    const derivedBalance = balancesMap[acc.id] ?? 0;
                    return (
                      <div
                        key={acc.id}
                        className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card hover:border-primary/40 transition-colors"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-muted-foreground">
                            {acc.type === 'cash' && <Banknote className="w-4 h-4 text-emerald-500" />}
                            {(acc.type === 'upi' || acc.type === 'bank') && <Smartphone className="w-4 h-4 text-sky-500" />}
                            {acc.type === 'wallet' && <Wallet className="w-4 h-4 text-amber-500" />}
                            {acc.type === 'other_digital' && <Smartphone className="w-4 h-4 text-purple-500" />}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-xs font-semibold text-foreground">{acc.name}</span>
                              {acc.isExcludedFromSpendable && (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Locked / Excluded
                                </Badge>
                              )}
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                              Opening: ₹{(acc.openingBalancePaise / 100).toFixed(2)} • Type: {acc.type === 'bank' ? 'upi' : acc.type}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="text-right">
                            <MoneyDisplay
                              paise={derivedBalance}
                              className="text-sm font-bold block"
                              colorScheme="neutral"
                            />
                            <span className="text-[10px] text-muted-foreground">Current Balance</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setReconcileAccount(acc);
                              setReconcileStatedAmount(paiseToRupees(derivedBalance).toFixed(2));
                              setIsReconcileOpen(true);
                            }}
                            title="Manually reconcile and create adjustment entry"
                          >
                            Reconcile
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Category Expense Breakdown Chart */}
            <Card className="flex flex-col">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">This Month's Spending</CardTitle>
                <CardDescription>Breakdown by expense category</CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col items-center justify-center pt-2">
                {expenseCategories.length === 0 ? (
                  <div className="text-center py-8 text-xs text-muted-foreground">
                    No expense records entered for this month yet.
                  </div>
                ) : (
                  <>
                    <div className="w-full h-44">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expenseCategories}
                            dataKey="amountPaise"
                            nameKey="category"
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={65}
                            paddingAngle={3}
                          >
                            {expenseCategories.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            formatter={(value: any) => [`₹${(value / 100).toFixed(2)}`, 'Spent']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="w-full space-y-1.5 mt-2 max-h-36 overflow-y-auto">
                      {expenseCategories.slice(0, 4).map((c, i) => (
                        <div key={c.category} className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: COLORS[i % COLORS.length] }}
                            />
                            <span className="text-muted-foreground truncate max-w-[120px]">{c.category}</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <span className="font-semibold tabular-nums">₹{(c.amountPaise / 100).toFixed(0)}</span>
                            <span className="text-[10px] text-muted-foreground">({c.percentage}%)</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: TRANSACTION LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4 animate-fade-in">
          {/* Ledger Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border">
            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search description, tag..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/50 rounded-lg border border-border focus:outline-none"
              />
            </div>

            <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
              <Select
                value={filterType}
                onChange={e => setFilterType(e.target.value)}
                className="text-xs h-8"
              >
                <option value="all">All Types</option>
                <option value="expense">Expenses Only</option>
                <option value="income">Income Only</option>
                <option value="transfer">Transfers Only</option>
                <option value="earning_payout">Platform Payouts</option>
                <option value="adjustment">Reconciliations</option>
              </Select>

              <Select
                value={filterAccount}
                onChange={e => setFilterAccount(e.target.value)}
                className="text-xs h-8"
              >
                <option value="all">All Accounts</option>
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {/* Ledger Table */}
          {filteredTransactions.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-6 h-6" />}
              title="No transactions found"
              description="Record your college expenses or stipend to see live balance derivation."
            />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3.5">Date</th>
                      <th className="py-2.5 px-3.5">Title & Context</th>
                      <th className="py-2.5 px-3.5">Type & Category</th>
                      <th className="py-2.5 px-3.5">Account</th>
                      <th className="py-2.5 px-3.5 text-right">Amount</th>
                      <th className="py-2.5 px-3.5 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredTransactions.map(t => {
                      let accountDisplay = '';
                      if ('accountId' in t) {
                        accountDisplay = accounts.find(a => a.id === t.accountId)?.name || t.accountId;
                      } else if (t.type === 'transfer') {
                        const fromName = accounts.find(a => a.id === t.fromAccountId)?.name || 'Src';
                        const toName = accounts.find(a => a.id === t.toAccountId)?.name || 'Dest';
                        accountDisplay = `${fromName} → ${toName}`;
                      }

                      return (
                        <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                          <td className="py-3 px-3.5 whitespace-nowrap text-muted-foreground tabular-nums">
                            {t.date}
                          </td>
                          <td className="py-3 px-3.5 font-medium text-foreground">
                            <div className="flex items-center space-x-1.5">
                              <span>{t.title}</span>
                              {t.isAutoGenerated && (
                                <Badge variant="secondary" className="text-[10px] py-0 px-1">
                                  Auto
                                </Badge>
                              )}
                            </div>
                            {t.notes && <p className="text-[11px] text-muted-foreground mt-0.5 truncate max-w-xs">{t.notes}</p>}
                          </td>
                          <td className="py-3 px-3.5">
                            <Badge
                              variant={
                                t.type === 'income' || t.type === 'earning_payout'
                                  ? 'success'
                                  : t.type === 'expense'
                                  ? 'destructive'
                                  : t.type === 'transfer'
                                  ? 'outline'
                                  : 'warning'
                              }
                            >
                              {'category' in t ? t.category : t.type}
                            </Badge>
                          </td>
                          <td className="py-3 px-3.5 text-muted-foreground">{accountDisplay}</td>
                          <td className="py-3 px-3.5 text-right font-semibold">
                            {t.type === 'income' || t.type === 'earning_payout' ? (
                              <MoneyDisplay paise={t.amountPaise} showSign colorScheme="income" />
                            ) : t.type === 'expense' ? (
                              <MoneyDisplay paise={-t.amountPaise} showSign colorScheme="expense" />
                            ) : t.type === 'adjustment' ? (
                              <MoneyDisplay paise={t.deltaPaise} showSign colorScheme="auto" />
                            ) : (
                              <MoneyDisplay paise={t.amountPaise} colorScheme="neutral" />
                            )}
                          </td>
                          <td className="py-3 px-3.5 text-center">
                            <button
                              onClick={() => setDeletingTx(t)}
                              className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                              title="Delete transaction"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}



      {/* TAB 4: LOANS & REPAYMENTS */}
      {activeTab === 'loans' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Loans & Peer Debts</h3>
              <p className="text-xs text-muted-foreground">Classmate loans, borrowed funds & repayments (Counterparty money)</p>
            </div>
            <Button size="sm" onClick={() => { setLoanPerson(''); setLoanAmount(''); setIsAddLoanOpen(true); }}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Record Loan
            </Button>
          </div>

          {/* Loans Global Position Header */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
              <span className="text-[11px] font-medium text-emerald-600 uppercase">You Are Owed (Receivable)</span>
              <div className="text-lg font-bold text-foreground mt-1">
                <MoneyDisplay paise={loansSummary.totalReceivablePaise} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Asset in Net Worth</p>
            </Card>

            <Card className="p-4 bg-rose-500/5 border-rose-500/20">
              <span className="text-[11px] font-medium text-rose-600 uppercase">You Owe (Payable)</span>
              <div className="text-lg font-bold text-foreground mt-1">
                <MoneyDisplay paise={loansSummary.totalPayablePaise} />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Liability in Net Worth</p>
            </Card>

            <Card className="p-4">
              <span className="text-[11px] font-medium text-muted-foreground uppercase">Net Position</span>
              <div className="text-lg font-bold text-foreground mt-1">
                <MoneyDisplay paise={loansSummary.netLoanPositionPaise} colorScheme="auto" showSign />
              </div>
              <p className="text-[10px] text-muted-foreground mt-0.5">Balance between friends</p>
            </Card>
          </div>

          {/* People Ledgers */}
          {loansSummary.personSummaries.length === 0 ? (
            <EmptyState
              icon={<Users className="w-6 h-6" />}
              title="No loans or counterparty debts"
              description="Track money lent to classmates or borrowed for semester fees with clear repayment histories."
              actionLabel="Record Loan"
              onAction={() => setIsAddLoanOpen(true)}
            />
          ) : (
            <div className="space-y-3">
              {loansSummary.personSummaries.map(p => (
                <Card key={p.personName} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="text-sm font-semibold text-foreground">{p.personName}</h4>
                        {p.isOverdue && <Badge variant="destructive">Overdue</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {p.outstandingReceivablePaise > 0
                          ? `Owes you ₹${(p.outstandingReceivablePaise / 100).toFixed(2)}`
                          : p.outstandingPayablePaise > 0
                          ? `You owe ₹${(p.outstandingPayablePaise / 100).toFixed(2)}`
                          : 'Settled in full'}
                      </p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setLoanPerson(p.personName);
                        setLoanType(p.outstandingReceivablePaise > 0 ? 'loan_repayment_in' : 'loan_repayment_out');
                        setLoanAmount((Math.max(p.outstandingReceivablePaise, p.outstandingPayablePaise) / 100).toFixed(2));
                        setIsAddLoanOpen(true);
                      }}
                    >
                      Record Repayment
                    </Button>
                  </div>

                  {/* Micro transaction history */}
                  <div className="mt-3 pt-3 border-t border-border space-y-1">
                    {p.transactions.slice(-3).map(tx => (
                      <div key={tx.id} className="flex justify-between text-[11px] text-muted-foreground">
                        <span>{tx.date} • {tx.title}</span>
                        <span className="font-medium text-foreground">
                          ₹{(tx.amountPaise / 100).toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: RECURRING BILLS */}
      {activeTab === 'recurring' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-semibold text-foreground">Scheduled Subscriptions & Recurring Bills</h3>
              <p className="text-xs text-muted-foreground">Auto-generated idempotently when due</p>
            </div>
          </div>

          {recurringSchedules.length === 0 ? (
            <EmptyState
              icon={<Clock className="w-6 h-6" />}
              title="No recurring schedules"
              description="Keep track of WiFi recharge, room rent, or streaming subscriptions."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {recurringSchedules.map(r => (
                <Card key={r.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">{r.title}</h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {r.frequency} • Next due: {r.nextDueDate}
                      </p>
                    </div>
                    <MoneyDisplay paise={r.amountPaise} className="text-sm font-bold" />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD ACCOUNT */}
      <Modal isOpen={isAddAccountOpen} onClose={() => setIsAddAccountOpen(false)} title="Add Account">
        <div className="space-y-3.5">
          <Input
            label="Account Name"
            placeholder="e.g. Canara Bank UPI, Paytm Wallet, Cash Envelope"
            value={newAccName}
            onChange={e => setNewAccName(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={newAccType} onChange={e => setNewAccType(e.target.value as any)}>
              <option value="cash">Cash (Physical)</option>
              <option value="upi">UPI</option>
              <option value="wallet">Digital Wallet</option>
              <option value="other_digital">Other Digital</option>
            </Select>

            <Input
              label="Opening Balance (₹)"
              type="number"
              step="0.01"
              value={newAccOpening}
              onChange={e => setNewAccOpening(e.target.value)}
            />
          </div>

          <label className="flex items-center space-x-2 text-xs text-foreground cursor-pointer pt-1">
            <input
              type="checkbox"
              checked={newAccExcludeSpendable}
              onChange={e => setNewAccExcludeSpendable(e.target.checked)}
              className="rounded border-border text-primary"
            />
            <span>Exclude from Spendable Money (e.g. Locked Emergency Savings)</span>
          </label>

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddAccountOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateAccount}>Create Account</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: MANUAL RECONCILIATION */}
      <Modal
        isOpen={isReconcileOpen}
        onClose={() => setIsReconcileOpen(false)}
        title={`Reconcile ${reconcileAccount?.name || 'Account'}`}
        description="Creates a visible adjustment transaction to balance the ledger with your stated real-world balance."
      >
        {reconcileAccount && (
          <div className="space-y-3.5">
            <div className="p-3 bg-muted/40 rounded-lg text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Computed Balance:</span>
                <span className="font-semibold text-foreground">
                  ₹{((balancesMap[reconcileAccount.id] ?? 0) / 100).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Stated Real Balance:</span>
                <span className="font-semibold text-primary">₹{reconcileStatedAmount || '0.00'}</span>
              </div>
              <div className="flex justify-between pt-1 border-t border-border">
                <span className="text-muted-foreground">Adjustment Delta:</span>
                <span className="font-semibold">
                  {calculateReconciliationDelta(
                    rupeesToPaise(reconcileStatedAmount),
                    balancesMap[reconcileAccount.id] ?? 0
                  ) >= 0
                    ? '+'
                    : ''}
                  ₹
                  {(
                    calculateReconciliationDelta(
                      rupeesToPaise(reconcileStatedAmount),
                      balancesMap[reconcileAccount.id] ?? 0
                    ) / 100
                  ).toFixed(2)}
                </span>
              </div>
            </div>

            <Input
              label="Actual Balance Shown in Passbook/App (₹)"
              type="number"
              step="0.01"
              value={reconcileStatedAmount}
              onChange={e => setReconcileStatedAmount(e.target.value)}
            />

            <Textarea
              label="Reconciliation Reason Note (Mandatory)"
              placeholder="e.g. Unrecorded interest, cashback, forgotten cash tip"
              value={reconcileReason}
              onChange={e => setReconcileReason(e.target.value)}
            />

            <div className="pt-2 flex justify-end space-x-2">
              <Button variant="outline" onClick={() => setIsReconcileOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleReconcile} disabled={!reconcileReason.trim()}>
                Save Adjustment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* MODAL 3: ADD LOAN */}
      <Modal isOpen={isAddLoanOpen} onClose={() => setIsAddLoanOpen(false)} title="Record Loan / Debt">
        <div className="space-y-3.5">
          <Input
            label="Person Name"
            placeholder="e.g. Rahul, Sneha, Hostel Landlord"
            value={loanPerson}
            onChange={e => setLoanPerson(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select label="Type" value={loanType} onChange={e => setLoanType(e.target.value as any)}>
              <option value="loan_given">Loan Given (You lent money)</option>
              <option value="loan_received">Loan Received (You borrowed)</option>
              <option value="loan_repayment_in">Repayment In (Borrower paid you)</option>
              <option value="loan_repayment_out">Repayment Out (You paid lender)</option>
            </Select>

            <Input
              label="Amount (₹)"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={loanAmount}
              onChange={e => setLoanAmount(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Account Used"
              value={loanAccountId || accounts[0]?.id || ''}
              onChange={e => setLoanAccountId(e.target.value)}
            >
              {accounts.map(a => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.type})
                </option>
              ))}
            </Select>

            <Input
              label="Due Date (Optional)"
              type="date"
              value={loanDueDate}
              onChange={e => setLoanDueDate(e.target.value)}
            />
          </div>

          <Textarea
            label="Notes"
            placeholder="Context or agreement notes"
            value={loanNotes}
            onChange={e => setLoanNotes(e.target.value)}
          />

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddLoanOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateLoan} disabled={!loanPerson.trim() || !loanAmount}>
              Record Loan
            </Button>
          </div>
        </div>
      </Modal>



      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!deletingTx}
        onClose={() => setDeletingTx(null)}
        onConfirm={() => deletingTx && handleDeleteTransaction(deletingTx)}
        title={deletingTx?.type === 'earning_payout' ? 'Delete Earning Payout' : 'Delete Transaction'}
        description={
          deletingTx?.type === 'earning_payout'
            ? `Warning: Deleting "${deletingTx.title}" will revert linked earning records back to pending status and debit this payout from your ledger. Are you sure you want to proceed?`
            : `Are you sure you want to delete "${deletingTx?.title}"? You will be able to restore it from Trash.`
        }
      />
    </div>
  );
}
