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

  // Initialize user settings with sensible defaults if not present
  const initializeUserZeroData = async (user: User) => {
    if (user.role === 'admin') return;

    // Zero preset data: no default accounts, no default subjects, no default platforms.
    // The database starts with zero user data records. Only user settings are initialized.
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
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Kolkata',
        activeModules: {
          fitnessAndHabits: true,
          academics: true,
          onlineEarnings: true,
          loans: true,
          goals: true,
        },
        fitnessToggles: {
          water: false,
          sleep: false,
          workout: false,
          steps: false,
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
        customCategories: [],
        showOnboardingChecklist: true,
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
