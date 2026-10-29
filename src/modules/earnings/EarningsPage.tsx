import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import {
  Platform,
  EarningRecord,
  Withdrawal,
  EarningPayoutTransaction,
  Account,
  PlatformTrustStatus,
  ScamChecklist,
} from '../../domain/types';
import {
  calculateEarningsSummary,
  allocateEarningRecord,
  revertRecordAllocations,
  reclassifyEarningRecord,
} from '../../domain/earnings';
import { rupeesToPaise, convertForeignToInrPaise, paiseToRupees } from '../../domain/money';
import { validateSafeUrl } from '../../domain/safety';
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
  Briefcase,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  ArrowDownToLine,
  CheckCircle2,
  Clock,
  HelpCircle,
  Plus,
  RefreshCw,
  Trash2,
  DollarSign,
  TrendingUp,
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

export function EarningsPage() {
  const [activeTab, setActiveTab] = useState<'summary' | 'platforms' | 'records' | 'withdrawals'>('summary');
  const { success, error, toastWithUndo } = useToast();

  const platforms = useLiveQuery(() => db.platforms.toArray()) || [];
  const records = useLiveQuery(() => db.earningRecords.toArray()) || [];
  const withdrawals = useLiveQuery(() => db.withdrawals.toArray()) || [];
  const payoutTransactions = useLiveQuery(() =>
    db.transactions.where('type').equals('earning_payout').toArray()
  ) as EarningPayoutTransaction[] || [];
  const accounts = useLiveQuery(() => db.accounts.where('isArchived').equals(0).toArray()) || [];

  const todayStr = new Date().toISOString().slice(0, 10);

  // Pure domain summary
  const summary = useMemo(() => {
    return calculateEarningsSummary(records, withdrawals, payoutTransactions, platforms);
  }, [records, withdrawals, payoutTransactions, platforms]);

  // Modal Dialogs
  const [isAddPlatformOpen, setIsAddPlatformOpen] = useState(false);
  const [isAddRecordOpen, setIsAddRecordOpen] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isPayoutModalOpen, setIsPayoutModalOpen] = useState(false);
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<Withdrawal | null>(null);

  // Platform Form State
  const [platName, setPlatName] = useState('');
  const [platUrl, setPlatUrl] = useState('');
  const [platCategory, setPlatCategory] = useState('Freelancing');
  const [platCurrency, setPlatCurrency] = useState('INR');
  const [platMinWithdrawal, setPlatMinWithdrawal] = useState('0');
  const [platTrustStatus, setPlatTrustStatus] = useState<PlatformTrustStatus>('unverified');
  const [platTrustNotes, setPlatTrustNotes] = useState('');
  const [platWithdrawableReported, setPlatWithdrawableReported] = useState('0');
  const [scamChecks, setScamChecks] = useState<ScamChecklist>({
    upfrontFeesDemanded: false,
    unrealisticReturns: false,
    noClearPayoutProof: false,
    requestsSensitiveCredentials: false,
    referralPyramidStructure: false,
    noCompanyInformation: false,
    risingWithdrawalMinimum: false,
    unresponsiveSupport: false,
  });

  // Reclassification Modal
  const [reclassRecord, setReclassRecord] = useState<EarningRecord | null>(null);
  const [reclassTarget, setReclassTarget] = useState<'verified' | 'uncertain'>('verified');
  const [reclassReason, setReclassReason] = useState('');

  // Withdrawal Request Form State
  const [withPlatId, setWithPlatId] = useState('');
  const [withAmount, setWithAmount] = useState('');
  const [withExpectedDate, setWithExpectedDate] = useState('');

  // Payout Receipt Form State
  const [payoutAccountId, setPayoutAccountId] = useState('');
  const [payoutGrossAmount, setPayoutGrossAmount] = useState('');
  const [payoutFeeAmount, setPayoutFeeAmount] = useState('0');

  // Handle Add Platform
  const handleSavePlatform = async () => {
    const urlCheck = validateSafeUrl(platUrl);
    if (!urlCheck.isValid) {
      error('Invalid Website URL', urlCheck.error);
      return;
    }
    if (!platName.trim()) {
      error('Name required', 'Platform name cannot be empty.');
      return;
    }

    const now = new Date().toISOString();
    const newPlatform: Platform = {
      id: `plat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      name: platName.trim(),
      websiteUrl: urlCheck.normalizedUrl!,
      category: platCategory,
      defaultCurrency: platCurrency,
      withdrawalMinimumPaise: rupeesToPaise(platMinWithdrawal),
      trustStatus: platTrustStatus,
      trustNotes: platTrustNotes,
      scamChecklist: scamChecks as any,
      withdrawableBalanceReportedPaise: rupeesToPaise(platWithdrawableReported),
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.platforms.add(newPlatform);
    success('Platform added', `${newPlatform.name} has been added.`);
    setIsAddPlatformOpen(false);
    resetPlatformForm();
  };

  const resetPlatformForm = () => {
    setPlatName('');
    setPlatUrl('');
    setPlatMinWithdrawal('0');
    setPlatTrustStatus('unverified');
    setPlatTrustNotes('');
    setPlatWithdrawableReported('0');
  };

  // Handle Request Withdrawal
  const handleRequestWithdrawal = async () => {
    const platform = platforms.find(p => p.id === withPlatId);
    if (!platform) {
      error('Platform required', 'Please select a platform.');
      return;
    }

    const requestedPaise = rupeesToPaise(withAmount);
    if (requestedPaise <= 0) {
      error('Invalid amount', 'Withdrawal amount must be greater than zero.');
      return;
    }

    // Allocate against pending earning records of this platform
    const platformRecords = records
      .filter(r => !r.deletedAt && r.platformId === platform.id && r.classification === 'verified')
      .sort((a, b) => a.date.localeCompare(b.date));

    let neededPaise = requestedPaise;
    const allocations: { earningRecordId: string; allocatedPaise: number }[] = [];
    const updatedRecords: EarningRecord[] = [];

    for (const rec of platformRecords) {
      if (neededPaise <= 0) break;
      const currentAlloc = rec.allocatedToWithdrawalPaise || 0;
      const available = rec.inrAmountPaise - currentAlloc;

      if (available > 0) {
        const toTake = Math.min(neededPaise, available);
        allocations.push({ earningRecordId: rec.id, allocatedPaise: toTake });
        updatedRecords.push({
          ...rec,
          allocatedToWithdrawalPaise: currentAlloc + toTake,
          updatedAt: new Date().toISOString(),
        });
        neededPaise -= toTake;
      }
    }

    const now = new Date().toISOString();
    const newWithdrawal: Withdrawal = {
      id: `w_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      platformId: platform.id,
      requestedDate: todayStr,
      amountPaise: requestedPaise,
      status: 'requested',
      allocations,
      expectedArrivalDate: withExpectedDate || undefined,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    // Save in Dexie
    await db.transaction('rw', [db.withdrawals, db.earningRecords], async () => {
      await db.withdrawals.add(newWithdrawal);
      for (const rec of updatedRecords) {
        await db.earningRecords.put(rec);
      }
    });

    success('Withdrawal Requested', `₹${(requestedPaise / 100).toFixed(2)} requested from ${platform.name}`);
    setIsWithdrawModalOpen(false);
    setWithAmount('');
  };

  // Handle Confirm Payout Received (Creates single earning_payout ledger transaction)
  const handleConfirmPayout = async () => {
    if (!selectedWithdrawal) return;
    const platform = platforms.find(p => p.id === selectedWithdrawal.platformId);
    const targetAccountId = payoutAccountId || accounts[0]?.id;

    if (!targetAccountId) {
      error('Account required', 'Please select which bank/wallet account received this money.');
      return;
    }

    const grossPaise = rupeesToPaise(payoutGrossAmount || paiseToRupees(selectedWithdrawal.amountPaise).toString());
    const feePaise = rupeesToPaise(payoutFeeAmount);
    const netPaise = grossPaise - feePaise;

    if (netPaise <= 0) {
      error('Invalid amounts', 'Net received amount must be positive.');
      return;
    }

    const now = new Date().toISOString();
    const payoutTx: EarningPayoutTransaction = {
      id: `payout_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      type: 'earning_payout',
      date: todayStr,
      title: `${platform?.name || 'Platform'} Payout`,
      accountId: targetAccountId,
      amountPaise: netPaise,
      grossPaise,
      feePaise,
      platformId: selectedWithdrawal.platformId,
      withdrawalId: selectedWithdrawal.id,
      allocatedRecordIds: (selectedWithdrawal.allocations || []).map(a => a.earningRecordId),
      notes: `Withdrawal received into account. Gross: ₹${(grossPaise / 100).toFixed(2)}, Fee: ₹${(feePaise / 100).toFixed(2)}`,
      tags: ['payout', platform?.name.toLowerCase() || 'earning'],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.transaction('rw', [db.transactions, db.withdrawals], async () => {
      await db.transactions.add(payoutTx);
      await db.withdrawals.update(selectedWithdrawal.id, {
        status: 'received',
        payoutTransactionId: payoutTx.id,
        updatedAt: now,
      });
    });

    success(
      'Payout Recorded to Ledger',
      `+₹${(netPaise / 100).toFixed(2)} credited to ${accounts.find(a => a.id === targetAccountId)?.name}`
    );
    setIsPayoutModalOpen(false);
    setSelectedWithdrawal(null);
  };

  // Handle Failed/Rejected Withdrawal (Restores pending allocations on records)
  const handleRejectWithdrawal = async (w: Withdrawal) => {
    const now = new Date().toISOString();
    const allRecords = await db.earningRecords.toArray();
    const restored = revertRecordAllocations(
      allRecords,
      (w.allocations || []).map(a => ({ earningRecordId: a.earningRecordId, amountPaise: a.allocatedPaise }))
    );

    await db.transaction('rw', [db.withdrawals, db.earningRecords], async () => {
      await db.withdrawals.update(w.id, { status: 'rejected', updatedAt: now });
      for (const r of restored) {
        await db.earningRecords.put(r);
      }
    });

    success('Withdrawal marked rejected', 'Allocations returned to pending balance.');
  };

  // Handle Reclassification
  const handleReclassify = async () => {
    if (!reclassRecord || !reclassReason.trim()) {
      error('Reason required', 'Please provide a justification for reclassification.');
      return;
    }

    const updated = reclassifyEarningRecord(
      reclassRecord,
      reclassTarget,
      reclassReason.trim(),
      {
        confidenceLevel: 'medium',
        reasonForUncertainty: reclassReason.trim(),
        reviewDate: todayStr,
      }
    );

    await db.earningRecords.put(updated);
    success('Record Reclassified', `Changed to ${reclassTarget}. Ledger money unchanged.`);
    setReclassRecord(null);
    setReclassReason('');
  };

  // Chart data: by platform
  const platformChartData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const r of records) {
      if (r.deletedAt) continue;
      const pName = platforms.find(p => p.id === r.platformId)?.name || 'Other';
      map[pName] = (map[pName] || 0) + (r.inrAmountPaise / 100);
    }
    return Object.entries(map).map(([name, amount]) => ({ name, amount }));
  }, [records, platforms]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Online Earnings Command</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Strict 3-state verification • No fake balances • Platform trust & scam warning checklist
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button size="sm" variant="outline" onClick={() => setIsAddPlatformOpen(true)}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Add Platform
          </Button>
          <Button size="sm" onClick={() => setIsWithdrawModalOpen(true)} disabled={platforms.length === 0}>
            <ArrowDownToLine className="w-3.5 h-3.5 mr-1.5" />
            Request Withdrawal
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs
        activeTab={activeTab}
        onChange={t => setActiveTab(t as any)}
        tabs={[
          { id: 'summary', label: 'Earnings Summary & Analytics', icon: <TrendingUp className="w-4 h-4" /> },
          { id: 'platforms', label: 'Platforms & Scam Checklist', icon: <Briefcase className="w-4 h-4" />, badge: platforms.length },
          { id: 'records', label: 'Earning Records', icon: <DollarSign className="w-4 h-4" />, badge: records.filter(r => !r.deletedAt).length },
          { id: 'withdrawals', label: 'Withdrawals & Payouts', icon: <ArrowDownToLine className="w-4 h-4" />, badge: withdrawals.length },
        ]}
      />

      {/* TAB 1: SUMMARY & ANALYTICS */}
      {activeTab === 'summary' && (
        <div className="space-y-6 animate-fade-in">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
            <Card className="bg-emerald-500/5 border-emerald-500/20">
              <CardContent className="p-4">
                <span className="text-[11px] font-medium text-emerald-600 uppercase tracking-wider">
                  Verified Received
                </span>
                <div className="text-xl font-bold text-foreground mt-1">
                  <MoneyDisplay paise={summary.verifiedReceivedPaise} colorScheme="income" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Credited in bank accounts via payouts
                </p>
              </CardContent>
            </Card>

            <Card className="bg-blue-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <span className="text-[11px] font-medium text-blue-600 uppercase tracking-wider">
                  Verified Pending
                </span>
                <div className="text-xl font-bold text-foreground mt-1">
                  <MoneyDisplay paise={summary.verifiedPendingPaise} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Proof held; awaiting platform payout
                </p>
              </CardContent>
            </Card>

            <Card className="bg-amber-500/5 border-amber-500/20">
              <CardContent className="p-4">
                <span className="text-[11px] font-medium text-amber-600 uppercase tracking-wider">
                  Uncertain Total
                </span>
                <div className="text-xl font-bold text-foreground mt-1">
                  <MoneyDisplay paise={summary.uncertainPaise} colorScheme="uncertain" />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Isolated; excluded from balances & net worth
                </p>
              </CardContent>
            </Card>

            <Card className="bg-card">
              <CardContent className="p-4">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Lifetime Earnings
                </span>
                <div className="text-xl font-bold text-foreground mt-1">
                  <MoneyDisplay paise={summary.lifetimeEarningsPaise} />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Received + Pending (no double count)
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Secondary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Card className="p-4">
              <span className="text-xs text-muted-foreground">Pending Withdrawals</span>
              <div className="text-base font-bold text-foreground mt-0.5">
                <MoneyDisplay paise={summary.pendingWithdrawalsPaise} />
              </div>
            </Card>
            <Card className="p-4">
              <span className="text-xs text-muted-foreground">User-Reported Withdrawable</span>
              <div className="text-base font-bold text-foreground mt-0.5">
                <MoneyDisplay paise={summary.withdrawableUserReportedPaise} />
              </div>
              <span className="text-[10px] text-muted-foreground block">(Manually reported by user)</span>
            </Card>
            <Card className="p-4">
              <span className="text-xs text-muted-foreground">Payout Success Rate</span>
              <div className="text-base font-bold text-foreground mt-0.5">
                {summary.payoutSuccessRate !== null ? `${summary.payoutSuccessRate}%` : 'Not enough data'}
              </div>
              <span className="text-[10px] text-muted-foreground block">
                {summary.payoutSuccessRate !== null ? 'Completed requests' : 'Requires at least 5 completed requests'}
              </span>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Earnings by Platform</CardTitle>
                <CardDescription>Breakdown across registered earning websites</CardDescription>
              </CardHeader>
              <CardContent className="h-64">
                {platformChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
                    No earning records yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={platformChartData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
                      <XAxis dataKey="name" fontSize={11} />
                      <YAxis fontSize={11} tickFormatter={v => `₹${v}`} />
                      <Tooltip formatter={(v: any) => [`₹${v.toFixed(2)}`, 'Earnings']} />
                      <Bar dataKey="amount" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Verification Status Distribution</CardTitle>
                <CardDescription>Verified vs Uncertain isolation</CardDescription>
              </CardHeader>
              <CardContent className="h-64 flex items-center justify-center">
                {summary.verifiedReceivedPaise === 0 &&
                summary.verifiedPendingPaise === 0 &&
                summary.uncertainPaise === 0 ? (
                  <div className="text-xs text-muted-foreground">No earnings recorded.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Verified Received', value: summary.verifiedReceivedPaise / 100 },
                          { name: 'Verified Pending', value: summary.verifiedPendingPaise / 100 },
                          { name: 'Uncertain', value: summary.uncertainPaise / 100 },
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={80}
                      >
                        <Cell fill="#10b981" />
                        <Cell fill="#3b82f6" />
                        <Cell fill="#f59e0b" />
                      </Pie>
                      <Tooltip formatter={(v: any) => [`₹${v.toFixed(2)}`, 'Amount']} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: PLATFORMS & SCAM CHECKLIST */}
      {activeTab === 'platforms' && (
        <div className="space-y-4 animate-fade-in">
          {platforms.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="w-6 h-6" />}
              title="No earning platforms added"
              description="Register platforms like Upwork, Fiverr, Remotasks, or campus tutoring gigs."
              actionLabel="Add First Platform"
              onAction={() => setIsAddPlatformOpen(true)}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {platforms.filter(p => !p.deletedAt).map(p => {
                const urlParsed = validateSafeUrl(p.websiteUrl);
                return (
                  <Card key={p.id} className="p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="text-sm font-semibold text-foreground">{p.name}</h4>
                          <Badge
                            variant={
                              p.trustStatus === 'user_verified'
                                ? 'success'
                                : p.trustStatus === 'suspected_scam'
                                ? 'destructive'
                                : 'warning'
                            }
                          >
                            {p.trustStatus.replace('_', ' ')}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">Category: {p.category}</p>
                      </div>

                      {urlParsed.isValid && (
                        <a
                          href={urlParsed.normalizedUrl}
                          target="_blank"
                          rel="noopener noreferrer nofollow"
                          className="flex items-center space-x-1 text-xs text-primary hover:underline bg-muted/60 px-2.5 py-1 rounded-md"
                        >
                          <span className="font-mono text-[11px]">{urlParsed.hostname}</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs bg-muted/30 p-2.5 rounded-lg">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Min. Withdrawal</span>
                        <span className="font-semibold tabular-nums">
                          ₹{(p.withdrawalMinimumPaise / 100).toFixed(2)}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[10px]">Withdrawable (Reported)</span>
                        <span className="font-semibold tabular-nums">
                          ₹{(p.withdrawableBalanceReportedPaise / 100).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    {/* Trust disclaimer */}
                    <p className="text-[10px] text-muted-foreground italic border-t border-border pt-2">
                      "This status is set by you. It is not an independent security audit."
                    </p>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EARNING RECORDS */}
      {activeTab === 'records' && (
        <div className="space-y-4 animate-fade-in">
          {records.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="w-6 h-6" />}
              title="No earning records"
              description="Add earnings from tasks or freelance work. Classification into Verified or Uncertain is required."
            />
          ) : (
            <div className="rounded-xl border border-border overflow-hidden bg-card">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
                  <tr>
                    <th className="py-2.5 px-3.5">Date</th>
                    <th className="py-2.5 px-3.5">Task / Platform</th>
                    <th className="py-2.5 px-3.5">Classification</th>
                    <th className="py-2.5 px-3.5 text-right">Amount (INR)</th>
                    <th className="py-2.5 px-3.5 text-center">Status</th>
                    <th className="py-2.5 px-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {records.filter(r => !r.deletedAt).map(r => {
                    const platformName = platforms.find(p => p.id === r.platformId)?.name || 'Platform';
                    const allocated = r.allocatedToWithdrawalPaise || 0;
                    const isFullyAllocated = allocated >= r.inrAmountPaise;

                    return (
                      <tr key={r.id} className="hover:bg-muted/30">
                        <td className="py-3 px-3.5 tabular-nums text-muted-foreground">{r.date}</td>
                        <td className="py-3 px-3.5 font-medium">
                          <span>{r.title}</span>
                          <span className="block text-[11px] text-muted-foreground">{platformName}</span>
                        </td>
                        <td className="py-3 px-3.5">
                          <Badge variant={r.classification === 'verified' ? 'verified' : 'uncertain'}>
                            {r.classification}
                          </Badge>
                          {r.classification === 'uncertain' && r.reasonForUncertainty && (
                            <span className="block text-[10px] text-muted-foreground truncate max-w-xs mt-0.5">
                              {r.reasonForUncertainty}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-right font-semibold">
                          <MoneyDisplay
                            paise={r.inrAmountPaise}
                            foreignAmountMinor={r.currency !== 'INR' ? r.amountMinorUnits : undefined}
                            foreignCurrency={r.currency}
                          />
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          {isFullyAllocated ? (
                            <Badge variant="outline" className="text-emerald-600">Withdrawn</Badge>
                          ) : allocated > 0 ? (
                            <Badge variant="outline" className="text-blue-600">Partial</Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </td>
                        <td className="py-3 px-3.5 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setReclassRecord(r);
                              setReclassTarget(r.classification === 'verified' ? 'uncertain' : 'verified');
                            }}
                          >
                            Reclassify
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: WITHDRAWALS & PAYOUTS */}
      {activeTab === 'withdrawals' && (
        <div className="space-y-4 animate-fade-in">
          {withdrawals.length === 0 ? (
            <EmptyState
              icon={<ArrowDownToLine className="w-6 h-6" />}
              title="No withdrawal requests"
              description="When you initiate a withdrawal from an earning platform, record it here to track arrivals."
              actionLabel="Request Withdrawal"
              onAction={() => setIsWithdrawModalOpen(true)}
            />
          ) : (
            <div className="space-y-3">
              {withdrawals.map(w => {
                const platform = platforms.find(p => p.id === w.platformId);
                return (
                  <Card key={w.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-foreground">
                          {platform?.name || 'Platform'} Withdrawal
                        </span>
                        <Badge
                          variant={
                            w.status === 'received'
                              ? 'success'
                              : w.status === 'rejected' || w.status === 'failed'
                              ? 'destructive'
                              : 'warning'
                          }
                        >
                          {w.status}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Requested: {w.requestedDate} • Amount: ₹{(w.amountPaise / 100).toFixed(2)}
                      </p>
                    </div>

                    <div className="flex items-center space-x-2">
                      {w.status === 'requested' || w.status === 'processing' ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedWithdrawal(w);
                              setPayoutGrossAmount(paiseToRupees(w.amountPaise).toFixed(2));
                              setIsPayoutModalOpen(true);
                            }}
                          >
                            Confirm Receipt
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectWithdrawal(w)}
                          >
                            Mark Failed
                          </Button>
                        </>
                      ) : (
                        <span className="text-xs text-muted-foreground font-medium">Completed</span>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: ADD PLATFORM */}
      <Modal isOpen={isAddPlatformOpen} onClose={() => setIsAddPlatformOpen(false)} title="Register Earning Platform" maxWidth="lg">
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Platform Name"
              placeholder="e.g. Upwork, Outlier, Prolific"
              value={platName}
              onChange={e => setPlatName(e.target.value)}
            />
            <Input
              label="Website URL (http/https)"
              placeholder="https://example.com"
              value={platUrl}
              onChange={e => setPlatUrl(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <Select label="Category" value={platCategory} onChange={e => setPlatCategory(e.target.value)}>
              <option value="Freelancing">Freelancing</option>
              <option value="Tutoring">Tutoring</option>
              <option value="Surveys/Microtasks">Surveys / Microtasks</option>
              <option value="Content/Writing">Content / Writing</option>
              <option value="Bounty/Coding">Bug Bounty / Coding</option>
            </Select>

            <Select label="Currency" value={platCurrency} onChange={e => setPlatCurrency(e.target.value)}>
              <option value="INR">INR (₹)</option>
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
            </Select>

            <Input
              label="Min. Withdrawal (₹)"
              type="number"
              step="1"
              value={platMinWithdrawal}
              onChange={e => setPlatMinWithdrawal(e.target.value)}
            />
          </div>

          {/* Trust Status & Disclaimer */}
          <div className="p-3 bg-muted/40 border border-border rounded-xl space-y-2">
            <label className="block text-xs font-semibold text-foreground">
              User Trust Assessment
            </label>
            <Select
              value={platTrustStatus}
              onChange={e => setPlatTrustStatus(e.target.value as PlatformTrustStatus)}
            >
              <option value="unverified">Unverified</option>
              <option value="under_review">Under Review</option>
              <option value="user_verified">User-Verified (I have received payouts)</option>
              <option value="suspected_scam">Suspected Scam</option>
            </Select>

            <p className="text-[10px] text-muted-foreground italic">
              "This status is set by you. It is not an independent security audit."
            </p>
          </div>

          {/* Scam-Warning Checklist */}
          <div className="border border-border p-3 rounded-xl space-y-2">
            <span className="text-xs font-semibold text-foreground block">
              Scam-Warning Checklist (Safety Reminders)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-muted-foreground">
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={scamChecks.upfrontFeesDemanded}
                  onChange={e => setScamChecks(prev => ({ ...prev, upfrontFeesDemanded: e.target.checked }))}
                />
                <span>Demands upfront "registration/security" deposit</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={scamChecks.requestsSensitiveCredentials}
                  onChange={e => setScamChecks(prev => ({ ...prev, requestsSensitiveCredentials: e.target.checked }))}
                />
                <span>Asks for UPI PIN, password, or OTP</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={scamChecks.unrealisticReturns}
                  onChange={e => setScamChecks(prev => ({ ...prev, unrealisticReturns: e.target.checked }))}
                />
                <span>Promises unrealistic guaranteed income</span>
              </label>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={scamChecks.referralPyramidStructure}
                  onChange={e => setScamChecks(prev => ({ ...prev, referralPyramidStructure: e.target.checked }))}
                />
                <span>Referral pyramid structure required to withdraw</span>
              </label>
            </div>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddPlatformOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSavePlatform}>Save Platform</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: REQUEST WITHDRAWAL */}
      <Modal isOpen={isWithdrawModalOpen} onClose={() => setIsWithdrawModalOpen(false)} title="Initiate Withdrawal">
        <div className="space-y-3.5">
          <Select
            label="Platform"
            value={withPlatId || platforms[0]?.id || ''}
            onChange={e => setWithPlatId(e.target.value)}
          >
            {platforms.map(p => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>

          <Input
            label="Withdrawal Amount (₹)"
            type="number"
            step="0.01"
            placeholder="0.00"
            value={withAmount}
            onChange={e => setWithAmount(e.target.value)}
          />

          <Input
            label="Expected Arrival Date (Optional)"
            type="date"
            value={withExpectedDate}
            onChange={e => setWithExpectedDate(e.target.value)}
          />

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsWithdrawModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRequestWithdrawal} disabled={!withAmount}>
              Record Request
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 3: CONFIRM PAYOUT RECEIPT INTO LEDGER */}
      <Modal
        isOpen={isPayoutModalOpen}
        onClose={() => setIsPayoutModalOpen(false)}
        title="Confirm Payout Received"
        description="Creates exactly one earning_payout transaction in your ledger, increasing your account balance and income."
      >
        <div className="space-y-3.5">
          <Select
            label="Credited Account"
            value={payoutAccountId || accounts[0]?.id || ''}
            onChange={e => setPayoutAccountId(e.target.value)}
          >
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.type})
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Gross Amount (₹)"
              type="number"
              step="0.01"
              value={payoutGrossAmount}
              onChange={e => setPayoutGrossAmount(e.target.value)}
            />
            <Input
              label="Platform Fee Deducted (₹)"
              type="number"
              step="0.01"
              value={payoutFeeAmount}
              onChange={e => setPayoutFeeAmount(e.target.value)}
            />
          </div>

          <div className="p-3 bg-muted/40 rounded-lg text-xs flex justify-between">
            <span className="text-muted-foreground">Net Credited to Account:</span>
            <span className="font-bold text-income">
              ₹{(
                parseFloat(payoutGrossAmount || '0') - parseFloat(payoutFeeAmount || '0')
              ).toFixed(2)}
            </span>
          </div>

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsPayoutModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirmPayout}>Record to Ledger</Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 4: RECLASSIFY RECORD */}
      <Modal isOpen={!!reclassRecord} onClose={() => setReclassRecord(null)} title="Reclassify Earning Record">
        <div className="space-y-3.5">
          <p className="text-xs text-muted-foreground">
            Current classification: <span className="font-semibold">{reclassRecord?.classification}</span>
          </p>

          <Select
            label="Target Classification"
            value={reclassTarget}
            onChange={e => setReclassTarget(e.target.value as any)}
          >
            <option value="verified">Verified (Proof / Invoice held)</option>
            <option value="uncertain">Uncertain (Pending review / question mark)</option>
          </Select>

          <Textarea
            label="Justification Reason (Mandatory)"
            placeholder="Explain why this record is being reclassified"
            value={reclassReason}
            onChange={e => setReclassReason(e.target.value)}
          />

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setReclassRecord(null)}>
              Cancel
            </Button>
            <Button onClick={handleReclassify} disabled={!reclassReason.trim()}>
              Save Reclassification
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
