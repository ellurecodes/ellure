import React, { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import {
  createFullBackup,
  inspectBackupJson,
  restoreBackup,
  exportTransactionsCsv,
  parseAndImportCsv,
  checkAndRequestStoragePersistence,
} from '../../db/backup';
import { SUGGESTED_STUDENT_CATEGORIES } from '../../db/seed';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import {
  ShieldAlert,
  HardDrive,
  Download,
  Upload,
  FileSpreadsheet,
  Trash2,
  AlertTriangle,
  Lock,
  CheckCircle2,
  X,
  Plus,
  Compass,
} from 'lucide-react';
import { useUserData } from '../../hooks/useUserData';

export function SettingsPage() {
  const { success, error } = useToast();
  const { currentUser, settings } = useUserData();

  // Persistence status
  const [persistenceState, setPersistenceState] = useState<{ isSupported: boolean; isPersisted: boolean }>({
    isSupported: false,
    isPersisted: false,
  });

  useEffect(() => {
    checkAndRequestStoragePersistence().then(setPersistenceState);
  }, []);

  // Student Settings Form
  const [studentName, setStudentName] = useState(settings?.studentName || currentUser?.displayName || 'Student');

  useEffect(() => {
    if (settings) {
      setStudentName(settings.studentName);
    }
  }, [settings]);

  // Handle Save Student Settings
  const handleSaveStudentSettings = async () => {
    if (!settings && !currentUser) return;
    const settingsId = settings?.id || `settings_${currentUser?.id}`;
    await db.settings.put({
      ...(settings || {
        id: settingsId,
        userId: currentUser?.id,
        theme: 'system',
        currency: 'INR',
        timezone: 'Asia/Kolkata',
        dailySpendingLimitPaise: 0,
        weeklyBudgetPaise: 0,
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
          weight: false,
        },
        widgetOrder: [
          'balance_summary',
          'cash_flow',
          'earnings_glance',
          'today_tasks',
          'habit_tracker',
          'goals_snapshot',
          'recent_transactions',
        ],
        widgetVisibility: {
          balance_summary: true,
          cash_flow: true,
          earnings_glance: true,
          today_tasks: true,
          habit_tracker: true,
          goals_snapshot: true,
          recent_transactions: true,
        },
        hasSeenOnboarding: true,
      }),
      studentName: studentName.trim(),
      monthlyAllowancePaise: settings?.monthlyAllowancePaise || 0,
      allowanceResetDay: settings?.allowanceResetDay || 1,
    });
    success('Settings saved', 'Profile updated.');
  };

  // Restore Modal State
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [backupJsonText, setBackupJsonText] = useState('');
  const [backupInspection, setBackupInspection] = useState<ReturnType<typeof inspectBackupJson> | null>(null);
  const [restoreMode, setRestoreMode] = useState<'replace' | 'merge'>('replace');

  // CSV Import State
  const [csvImportErrors, setCsvImportErrors] = useState<string[] | null>(null);
  const [isCsvErrorModalOpen, setIsCsvErrorModalOpen] = useState(false);

  // Danger Zone Clear Data
  const [isClearDataOpen, setIsClearDataOpen] = useState(false);
  const [typedConfirmation, setTypedConfirmation] = useState('');

  // Handle Request Persistence
  const handleRequestPersist = async () => {
    const res = await checkAndRequestStoragePersistence();
    setPersistenceState(res);
    if (res.isPersisted) {
      success('Storage persisted', 'Browser will not automatically evict LifeOS database.');
    } else {
      error('Persistence denied', 'Browser refused persistent storage permission.');
    }
  };

  // Handle Export Full JSON
  const handleExportJson = async () => {
    const json = await createFullBackup();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    success('Backup exported', 'Full JSON backup downloaded to your device.');
  };

  // Handle File Input for Restore
  const handleFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = event => {
      const text = event.target?.result as string;
      setBackupJsonText(text);
      const inspected = inspectBackupJson(text);
      setBackupInspection(inspected);
      setIsRestoreModalOpen(true);
    };
    reader.readAsText(file);
  };

  // Execute Restore
  const handleExecuteRestore = async () => {
    if (!backupInspection?.payload) return;

    try {
      const { safetyBackupJson } = await restoreBackup(backupInspection.payload, restoreMode);
      if (safetyBackupJson) {
        // Also download safety backup automatically
        const blob = new Blob([safetyBackupJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `safety_snapshot_before_restore_${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }

      success('Database restored', `Successfully loaded data in ${restoreMode} mode.`);
      setIsRestoreModalOpen(false);
      setBackupJsonText('');
      setBackupInspection(null);
    } catch (err: any) {
      error('Restore failed', err.message);
    }
  };

  // Handle Export CSV
  const handleExportCsv = async () => {
    const csv = await exportTransactionsCsv();
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifeos_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    success('CSV Exported', 'Transactions CSV downloaded with formula-injection sanitization.');
  };

  // Handle CSV Import
  const handleCsvFileChosen = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async event => {
      const text = event.target?.result as string;
      const res = await parseAndImportCsv(text, currentUser?.id);
      if (res.errors.length > 0) {
        setCsvImportErrors(res.errors);
        setIsCsvErrorModalOpen(true);
        if (res.importedCount > 0) {
          success('Partial Import', `Imported ${res.importedCount} rows (${res.errors.length} failed).`);
        } else {
          error('CSV Import Failed', `Could not import rows. Please review formatting.`);
        }
      } else {
        success('CSV Imported', `Successfully added ${res.importedCount} transactions (${res.skippedCount} skipped as duplicates).`);
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const [newCatName, setNewCatName] = useState('');

  // Handle Adding Custom Category
  const handleAddCategory = async () => {
    const trimmed = newCatName.trim();
    if (!trimmed) return;
    const currentCats = settings?.customCategories || [];
    if (currentCats.includes(trimmed)) {
      error('Duplicate Category', 'This category already exists.');
      return;
    }
    const updated = [...currentCats, trimmed];
    if (settings) {
      await db.settings.update(settings.id, { customCategories: updated });
      success('Category Added', `Added "${trimmed}" to your categories.`);
      setNewCatName('');
    }
  };

  // Handle Removing Custom Category
  const handleRemoveCategory = async (cat: string) => {
    if (!settings) return;
    const updated = (settings.customCategories || []).filter(c => c !== cat);
    await db.settings.update(settings.id, { customCategories: updated });
    success('Category Removed', `Removed "${cat}".`);
  };

  // Handle Adding Suggested Student Categories
  const handleAddSuggestedCategories = async () => {
    if (!settings) return;
    const currentCats = settings.customCategories || [];
    const merged = Array.from(new Set([...currentCats, ...SUGGESTED_STUDENT_CATEGORIES]));
    await db.settings.update(settings.id, { customCategories: merged });
    success('Categories Added', `Added ${SUGGESTED_STUDENT_CATEGORIES.length} suggested student categories.`);
  };

  // Handle Toggle Onboarding Checklist
  const handleToggleChecklist = async () => {
    if (!settings) return;
    const currentVal = settings.showOnboardingChecklist !== false;
    await db.settings.update(settings.id, { showOnboardingChecklist: !currentVal });
    success('Preference Updated', !currentVal ? 'Getting started checklist enabled on dashboard.' : 'Checklist hidden from dashboard.');
  };

  // Handle Complete Data Wipe (Restores zero-data state)
  const handleWipeAllData = async () => {
    if (typedConfirmation !== 'DELETE ALL DATA') {
      error('Confirmation mismatch', 'Type "DELETE ALL DATA" exactly to proceed.');
      return;
    }

    // Safety backup first
    await handleExportJson();

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
      db.fitnessMetricLogs.clear(),
      db.goals.clear(),
    ]);

    if (settings) {
      await db.settings.update(settings.id, {
        monthlyAllowancePaise: 0,
        dailySpendingLimitPaise: 0,
        weeklyBudgetPaise: 0,
        customCategories: [],
        showOnboardingChecklist: true,
        hasSeenOnboarding: false,
      });
    }

    success('Data deleted', 'All data has been wiped. App restored to clean zero-data state.');
    setIsClearDataOpen(false);
    setTypedConfirmation('');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="border-b border-border pb-4">
        <h1 className="text-xl font-bold tracking-tight text-foreground">Settings & Privacy Center</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Zero-cloud architecture • Data backups • Storage persistence • Security reminders
        </p>
      </div>

      {/* NON-NEGOTIABLE PRIVACY & SECURITY STATEMENT */}
      <Card className="p-4 bg-muted/40 border-border">
        <div className="flex items-start space-x-3">
          <ShieldAlert className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="text-xs space-y-1.5">
            <h3 className="font-semibold text-foreground">Local-First Storage & Security Architecture</h3>
            <p className="text-muted-foreground leading-relaxed">
              All your records, earnings, accounts, and tasks stay strictly inside this browser on this device.
              Nothing is ever uploaded to a server or cloud database.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              <strong className="text-foreground">Important Note:</strong> Data is stored in browser IndexedDB
              and is <span className="underline font-medium">NOT encrypted at rest</span>. If you share this
              computer account or clear your browser data, your records can be viewed or lost. Make regular JSON
              backups using the export tool below.
            </p>
            <div className="p-2.5 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-700 dark:text-rose-300 font-medium flex items-center space-x-2">
              <Lock className="w-4 h-4 shrink-0" />
              <span>
                Safety Rule: LifeOS will NEVER ask for your bank password, UPI PIN, OTP, or debit card CVV.
                Never enter banking credentials into any notes or forms.
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Student Profile Settings */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Student Profile Configuration</CardTitle>
          <CardDescription>Update your display name and student identity</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Student Name"
              value={studentName}
              onChange={e => setStudentName(e.target.value)}
            />
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={handleSaveStudentSettings}>
              Save Profile Changes
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Storage Persistence */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Device Storage Persistence</CardTitle>
          <CardDescription>Prevent browser from automatically clearing data under storage pressure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
            <div className="flex items-center space-x-3">
              <HardDrive className="w-5 h-5 text-primary" />
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  IndexedDB Storage Status:{' '}
                  {persistenceState.isPersisted ? (
                    <span className="text-emerald-600 font-bold">Persisted</span>
                  ) : (
                    <span className="text-amber-600 font-bold">Best-effort (Not persisted)</span>
                  )}
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {persistenceState.isPersisted
                    ? 'Browser has granted permanent local storage.'
                    : 'Browser may clear data if disk space runs critically low.'}
                </span>
              </div>
            </div>

            {!persistenceState.isPersisted && (
              <Button size="sm" variant="outline" onClick={handleRequestPersist}>
                Request Persistence
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Backup and Restore */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Backup, Restore & Data Migration</CardTitle>
          <CardDescription>Versioned JSON and sanitized CSV exports</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-start space-y-1 text-left" onClick={handleExportJson}>
              <div className="flex items-center space-x-2 text-foreground font-semibold text-xs">
                <Download className="w-4 h-4 text-primary" />
                <span>Export Full Backup (JSON)</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                All 9 modules, versioned schema, safely importable anytime.
              </span>
            </Button>

            <label className="border border-border rounded-xl p-4 flex flex-col items-start space-y-1 cursor-pointer hover:bg-muted/30 transition-colors">
              <input type="file" accept=".json" onChange={handleFileChosen} className="hidden" />
              <div className="flex items-center space-x-2 text-foreground font-semibold text-xs">
                <Upload className="w-4 h-4 text-emerald-500" />
                <span>Restore Backup (JSON)</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Validate schema, inspect preview, and choose merge or replace.
              </span>
            </label>

            <Button variant="outline" className="h-auto p-4 flex flex-col items-start space-y-1 text-left" onClick={handleExportCsv}>
              <div className="flex items-center space-x-2 text-foreground font-semibold text-xs">
                <FileSpreadsheet className="w-4 h-4 text-sky-500" />
                <span>Export CSV (Spreadsheet)</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Sanitized against spreadsheet formula injection (=, +, -, @).
              </span>
            </Button>

            <label className="border border-border rounded-xl p-4 flex flex-col items-start space-y-1 cursor-pointer hover:bg-muted/30 transition-colors">
              <input type="file" accept=".csv" onChange={handleCsvFileChosen} className="hidden" />
              <div className="flex items-center space-x-2 text-foreground font-semibold text-xs">
                <Upload className="w-4 h-4 text-sky-500" />
                <span>Import CSV (Spreadsheet)</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Imports transactions with column validation & duplicate check.
              </span>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Dashboard & Onboarding Preferences */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Dashboard & Onboarding Preferences</CardTitle>
          <CardDescription>Configure first-run guidance and onboarding widgets</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-xl">
            <div className="flex items-center space-x-3">
              <Compass className="w-5 h-5 text-primary" />
              <div>
                <span className="text-xs font-semibold text-foreground block">
                  Getting Started Checklist on Dashboard
                </span>
                <span className="text-[11px] text-muted-foreground block">
                  {settings?.showOnboardingChecklist !== false
                    ? 'Checklist is currently displayed on your Dashboard to guide setup.'
                    : 'Checklist is hidden from the Dashboard.'}
                </span>
              </div>
            </div>
            <Button size="sm" variant="outline" onClick={handleToggleChecklist}>
              {settings?.showOnboardingChecklist !== false ? 'Hide Checklist' : 'Show Checklist'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Expense Categories Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Expense Categories Management</CardTitle>
          <CardDescription>Define and customize your personal ledger categories</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground leading-relaxed">
            By default, LifeOS starts with zero categories. You can create your own custom categories or populate standard student categories with one click.
          </p>

          {/* Add Category Form */}
          <div className="flex items-center space-x-2">
            <Input
              placeholder="e.g. Canteen, Textbooks, Metro Pass..."
              value={newCatName}
              onChange={e => setNewCatName(e.target.value)}
              className="h-8 text-xs max-w-xs"
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
            />
            <Button size="sm" onClick={handleAddCategory}>
              <Plus className="w-3.5 h-3.5 mr-1" />
              Add Category
            </Button>
            <Button size="sm" variant="outline" onClick={handleAddSuggestedCategories}>
              Add Suggested Student Categories
            </Button>
          </div>

          {/* Existing Categories Chips */}
          <div className="pt-2">
            <span className="text-[11px] font-semibold uppercase text-muted-foreground block mb-2">
              Active Categories ({settings?.customCategories?.length || 0})
            </span>
            {(settings?.customCategories || []).length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No categories configured yet. Click "Add Suggested Student Categories" or add one above.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {(settings?.customCategories || []).map(cat => (
                  <span
                    key={cat}
                    className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-muted text-foreground border border-border"
                  >
                    <span>{cat}</span>
                    <button
                      onClick={() => handleRemoveCategory(cat)}
                      className="text-muted-foreground hover:text-destructive transition-colors ml-1"
                      title={`Remove ${cat}`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-rose-500/20 bg-rose-500/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
          <CardDescription>Permanently wipe all records from this browser</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            This will permanently delete all accounts, transactions, earnings, academic submissions, and habits stored in this browser. A safety JSON backup will be downloaded before wiping.
          </p>
          <Button size="sm" variant="destructive" onClick={() => setIsClearDataOpen(true)}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Delete All Local Data
          </Button>
        </CardContent>
      </Card>

      {/* RESTORE PREVIEW MODAL */}
      <Modal isOpen={isRestoreModalOpen} onClose={() => setIsRestoreModalOpen(false)} title="Inspect & Restore Backup" maxWidth="lg">
        {backupInspection && (
          <div className="space-y-4">
            {!backupInspection.isValid ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-600">
                <p className="font-semibold">Validation Failed</p>
                <p>{backupInspection.error}</p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-700 dark:text-emerald-300">
                  <p className="font-semibold">Backup Validated Successfully</p>
                  <p>Exported at: {backupInspection.payload?.exportedAt}</p>
                </div>

                <div className="space-y-1">
                  <span className="text-xs font-semibold text-foreground">Record Counts in Backup:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs bg-muted/40 p-3 rounded-lg">
                    {Object.entries(backupInspection.summary || {}).map(([key, count]) => (
                      <div key={key}>
                        <span className="text-muted-foreground text-[11px] block">{key}</span>
                        <span className="font-bold tabular-nums">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <span className="text-xs font-semibold text-foreground">Restore Strategy:</span>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <label
                      className={`p-3 rounded-lg border cursor-pointer ${
                        restoreMode === 'replace'
                          ? 'border-primary bg-primary/10'
                          : 'border-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        checked={restoreMode === 'replace'}
                        onChange={() => setRestoreMode('replace')}
                        className="mr-2"
                      />
                      <span className="font-semibold">Replace All Data</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Wipes current database and replaces it. An automatic safety snapshot will be downloaded first.
                      </p>
                    </label>

                    <label
                      className={`p-3 rounded-lg border cursor-pointer ${
                        restoreMode === 'merge'
                          ? 'border-primary bg-primary/10'
                          : 'border-border'
                      }`}
                    >
                      <input
                        type="radio"
                        name="mode"
                        checked={restoreMode === 'merge'}
                        onChange={() => setRestoreMode('merge')}
                        className="mr-2"
                      />
                      <span className="font-semibold">Merge Records</span>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Keeps existing records and updates matching IDs.
                      </p>
                    </label>
                  </div>
                </div>

                <div className="pt-2 flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsRestoreModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleExecuteRestore}>Execute Restore</Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* CLEAR ALL DATA CONFIRMATION MODAL */}
      <Modal isOpen={isClearDataOpen} onClose={() => setIsClearDataOpen(false)} title="Confirm Complete Data Wipe" maxWidth="sm">
        <div className="space-y-3.5 text-center p-2">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-500 mx-auto flex items-center justify-center">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <p className="text-xs text-muted-foreground">
            To prevent accidental loss, please type <strong className="text-foreground">DELETE ALL DATA</strong> below.
            A safety backup file will be generated before wiping.
          </p>

          <Input
            value={typedConfirmation}
            onChange={e => setTypedConfirmation(e.target.value)}
            placeholder="DELETE ALL DATA"
          />

          <div className="flex space-x-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setIsClearDataOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={typedConfirmation !== 'DELETE ALL DATA'}
              onClick={handleWipeAllData}
            >
              Wipe Everything
            </Button>
          </div>
        </div>
      </Modal>

      {/* CSV IMPORT VALIDATION REPORT MODAL */}
      <Modal
        isOpen={isCsvErrorModalOpen}
        onClose={() => setIsCsvErrorModalOpen(false)}
        title="CSV Import Validation Report"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-700 dark:text-amber-400">
            <p className="font-semibold mb-1">CSV Format Warnings or Failures:</p>
            <p className="text-[11px] leading-relaxed">
              Some or all rows in the selected spreadsheet file could not be imported due to column mismatches, invalid calendar dates, or unknown values.
            </p>
          </div>

          <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 bg-muted/40 rounded-xl border border-border text-xs font-mono">
            {csvImportErrors?.map((err, idx) => (
              <div key={idx} className="p-1.5 rounded bg-card/60 text-destructive text-[11px] flex items-start space-x-2">
                <span className="font-bold">•</span>
                <span>{err}</span>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-2">
            <Button size="sm" onClick={() => setIsCsvErrorModalOpen(false)}>
              Close Report
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
