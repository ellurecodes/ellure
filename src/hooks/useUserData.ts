import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { useAuth } from '../context/AuthContext';

export function useUserData() {
  const { currentUser } = useAuth();
  const uid = currentUser?.id || '';

  const accounts = useLiveQuery(
    () => (uid ? db.accounts.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const transactions = useLiveQuery(
    () => (uid ? db.transactions.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const platforms = useLiveQuery(
    () => (uid ? db.platforms.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const earningRecords = useLiveQuery(
    () => (uid ? db.earningRecords.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const withdrawals = useLiveQuery(
    () => (uid ? db.withdrawals.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const budgets = useLiveQuery(
    () => (uid ? db.budgets.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const savingsGoals = useLiveQuery(
    () => (uid ? db.savingsGoals.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const recurringTransactions = useLiveQuery(
    () => (uid ? db.recurringTransactions.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const subjects = useLiveQuery(
    () => (uid ? db.subjects.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const academicTasks = useLiveQuery(
    () => (uid ? db.academicTasks.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const habits = useLiveQuery(
    () => (uid ? db.habits.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const habitLogs = useLiveQuery(
    () => (uid ? db.habitLogs.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const fitnessMetricLogs = useLiveQuery(
    () => (uid ? db.fitnessMetricLogs.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const goals = useLiveQuery(
    () => (uid ? db.goals.where('userId').equals(uid).toArray() : []),
    [uid]
  ) || [];

  const settings = useLiveQuery(
    () => (uid ? db.settings.where('userId').equals(uid).first() : undefined),
    [uid]
  );

  return {
    currentUser,
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
    fitnessMetricLogs,
    goals,
    settings,
  };
}
