import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { db } from '../db/db';
import { User, Account, UserSettings } from '../domain/types';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  register: (username: string, displayName: string, password: string) => Promise<{ success: boolean; error?: string; message?: string }>;
  logout: () => void;
  approveUser: (userId: string) => Promise<void>;
  rejectUser: (userId: string) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ACTIVE_USER_STORAGE_KEY = 'lifeos_active_user_id';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize Admin and check current session
  useEffect(() => {
    async function initAuth() {
      try {
        // Ensure default root administrator exists
        const adminUser = await db.users.where('username').equals('admin').first();
        if (!adminUser) {
          const now = new Date().toISOString();
          await db.users.add({
            id: 'admin_root',
            username: 'admin',
            displayName: 'System Admin',
            passwordHash: 'admin123',
            role: 'admin',
            status: 'approved',
            createdAt: now,
            updatedAt: now,
          });
        }

        // Check if there is an active logged-in user
        const storedUserId = localStorage.getItem(ACTIVE_USER_STORAGE_KEY);
        if (storedUserId) {
          const user = await db.users.get(storedUserId);
          if (user && user.status === 'approved') {
            setCurrentUser(user);
          } else {
            localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
          }
        }
      } catch (err) {
        console.error('Auth initialization error:', err);
      } finally {
        setIsLoading(false);
      }
    }

    initAuth();
  }, []);

  // Initialize clean zero-balance accounts for a newly approved user
  const initializeUserZeroData = async (user: User) => {
    if (user.role === 'admin') return;

    const existingAccounts = await db.accounts.where('userId').equals(user.id).toArray();
    if (existingAccounts.length === 0) {
      const now = new Date().toISOString();
      const defaultZeroAccounts: Account[] = [
        {
          id: `acc_cash_${user.id}`,
          userId: user.id,
          name: 'Physical Cash',
          type: 'cash',
          currency: 'INR',
          openingBalancePaise: 0, // Zero balance
          isExcludedFromSpendable: false,
          isArchived: false,
          color: '#10b981',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
        {
          id: `acc_bank_${user.id}`,
          userId: user.id,
          name: 'Bank Account',
          type: 'bank',
          currency: 'INR',
          openingBalancePaise: 0, // Zero balance
          institutionName: 'Student Savings Account',
          isExcludedFromSpendable: false,
          isArchived: false,
          color: '#2563eb',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
        {
          id: `acc_upi_${user.id}`,
          userId: user.id,
          name: 'UPI / Digital Wallet',
          type: 'upi',
          currency: 'INR',
          openingBalancePaise: 0, // Zero balance
          isExcludedFromSpendable: false,
          isArchived: false,
          color: '#0ea5e9',
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
        },
      ];

      await db.accounts.bulkAdd(defaultZeroAccounts);
    }

    // Initialize clean default course / subject if not present
    const existingSubjects = await db.subjects.where('userId').equals(user.id).toArray();
    if (existingSubjects.length === 0) {
      const now = new Date().toISOString();
      await db.subjects.add({
        id: `sub_core_${user.id}`,
        userId: user.id,
        code: 'CORE101',
        name: 'General Coursework',
        instructor: 'Faculty',
        credits: 3,
        color: '#3b82f6',
        isArchived: false,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Initialize clean default platform if not present
    const existingPlatforms = await db.platforms.where('userId').equals(user.id).toArray();
    if (existingPlatforms.length === 0) {
      const now = new Date().toISOString();
      await db.platforms.add({
        id: `plat_direct_${user.id}`,
        userId: user.id,
        name: 'Freelance & Direct Clients',
        websiteUrl: 'https://freelance.local',
        category: 'Freelancing',
        defaultCurrency: 'INR',
        withdrawalMinimumPaise: 0,
        trustStatus: 'user_verified',
        trustNotes: 'Personal direct client projects and campus gigs.',
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
        withdrawableBalanceReportedPaise: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }

    // Initialize user settings if not present
    const existingSettings = await db.settings.where('userId').equals(user.id).first();
    if (!existingSettings) {
      const defaultSettings: UserSettings = {
        id: `settings_${user.id}`,
        userId: user.id,
        studentName: user.displayName,
        monthlyAllowancePaise: 0,
        allowanceResetDay: 1,
        dailySpendingLimitPaise: 0,
        weeklyBudgetPaise: 0,
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
          weight: false,
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
      await db.settings.put(defaultSettings);
    }
  };

  // Login handler
  const login = useCallback(async (username: string, password: string) => {
    const cleanUsername = username.trim().toLowerCase();
    const user = await db.users.where('username').equals(cleanUsername).first();

    if (!user || user.passwordHash !== password) {
      return { success: false, error: 'Invalid username or password.' };
    }

    if (user.status === 'pending') {
      return {
        success: false,
        error: 'Your registration is pending administrator approval. Please wait for the admin to accept your account.',
      };
    }

    if (user.status === 'rejected') {
      return {
        success: false,
        error: 'Your account registration was rejected by the administrator.',
      };
    }

    // Initialize clean slate if new user
    await initializeUserZeroData(user);

    localStorage.setItem(ACTIVE_USER_STORAGE_KEY, user.id);
    setCurrentUser(user);
    return { success: true };
  }, []);

  // Registration handler
  const register = useCallback(async (username: string, displayName: string, password: string) => {
    const cleanUsername = username.trim().toLowerCase();
    if (cleanUsername.length < 3) {
      return { success: false, error: 'Username must be at least 3 characters long.' };
    }
    if (password.length < 4) {
      return { success: false, error: 'Password must be at least 4 characters long.' };
    }

    const existing = await db.users.where('username').equals(cleanUsername).first();
    if (existing) {
      return { success: false, error: 'Username already taken. Please choose another.' };
    }

    const now = new Date().toISOString();
    const newUser: User = {
      id: `user_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      username: cleanUsername,
      displayName: displayName.trim() || cleanUsername,
      passwordHash: password,
      role: 'user',
      status: 'pending', // Requires admin approval
      createdAt: now,
      updatedAt: now,
    };

    await db.users.add(newUser);
    return {
      success: true,
      message: 'Account registered successfully! An administrator must approve your account before you can log in.',
    };
  }, []);

  // Logout handler
  const logout = useCallback(() => {
    localStorage.removeItem(ACTIVE_USER_STORAGE_KEY);
    setCurrentUser(null);
  }, []);

  // Admin: Approve User
  const approveUser = useCallback(async (userId: string) => {
    const now = new Date().toISOString();
    await db.users.update(userId, { status: 'approved', updatedAt: now });
  }, []);

  // Admin: Reject User
  const rejectUser = useCallback(async (userId: string) => {
    const now = new Date().toISOString();
    await db.users.update(userId, { status: 'rejected', updatedAt: now });
  }, []);

  // Admin: Delete User (Strictly removes user; zero inspection of user records)
  const deleteUser = useCallback(async (userId: string) => {
    await db.transaction(
      'rw',
      [
        db.users,
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
        db.settings,
      ],
      async () => {
        await db.users.delete(userId);
        // Wipe isolated records associated with this deleted user
        await db.accounts.where('userId').equals(userId).delete();
        await db.transactions.where('userId').equals(userId).delete();
        await db.platforms.where('userId').equals(userId).delete();
        await db.earningRecords.where('userId').equals(userId).delete();
        await db.withdrawals.where('userId').equals(userId).delete();
        await db.budgets.where('userId').equals(userId).delete();
        await db.savingsGoals.where('userId').equals(userId).delete();
        await db.recurringTransactions.where('userId').equals(userId).delete();
        await db.subjects.where('userId').equals(userId).delete();
        await db.academicTasks.where('userId').equals(userId).delete();
        await db.habits.where('userId').equals(userId).delete();
        await db.habitLogs.where('userId').equals(userId).delete();
        await db.goals.where('userId').equals(userId).delete();
        await db.settings.where('userId').equals(userId).delete();
      }
    );
  }, []);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        isLoading,
        login,
        register,
        logout,
        approveUser,
        rejectUser,
        deleteUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
