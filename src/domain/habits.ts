import { HabitLog } from './types';

export interface StreakInfo {
  currentStreak: number;
  longestStreak: number;
  completedToday: boolean;
  totalCompletions: number;
  completionRatePercentage: number;
}

/**
 * Calculates current streak and longest streak for a habit.
 * Correctly accounts for:
 * - Today's completion (if completed today, streak includes today).
 * - If not yet completed today, but completed yesterday, the streak remains intact from yesterday.
 * - If yesterday was missed and today is not completed, streak resets to 0.
 * - Contiguous dates in YYYY-MM-DD local format.
 */
export function calculateHabitStreak(
  logs: HabitLog[],
  todayStr: string = new Date().toISOString().slice(0, 10)
): StreakInfo {
  const completedLogs = logs
    .filter(l => l.completed)
    .map(l => l.date)
    .filter((v, i, a) => a.indexOf(v) === i) // deduplicate
    .sort();

  if (completedLogs.length === 0) {
    return {
      currentStreak: 0,
      longestStreak: 0,
      completedToday: false,
      totalCompletions: 0,
      completionRatePercentage: 0,
    };
  }

  const completedSet = new Set(completedLogs);
  const completedToday = completedSet.has(todayStr);

  // Helper to get previous date string (YYYY-MM-DD)
  const getPrevDayStr = (dStr: string): string => {
    const d = new Date(dStr + 'T12:00:00Z'); // midday to avoid DST/shift
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  };

  // Helper to get next day string
  const getNextDayStr = (dStr: string): string => {
    const d = new Date(dStr + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  };

  // 1. Calculate longest streak across all completed dates
  let longestStreak = 0;
  let currentRun = 0;
  let lastDate: string | null = null;

  for (const date of completedLogs) {
    if (lastDate && getNextDayStr(lastDate) === date) {
      currentRun++;
    } else {
      currentRun = 1;
    }
    lastDate = date;
    if (currentRun > longestStreak) {
      longestStreak = currentRun;
    }
  }

  // 2. Calculate current streak
  let currentStreak = 0;
  let checkDate = completedToday ? todayStr : getPrevDayStr(todayStr);

  while (completedSet.has(checkDate)) {
    currentStreak++;
    checkDate = getPrevDayStr(checkDate);
  }

  return {
    currentStreak,
    longestStreak,
    completedToday,
    totalCompletions: completedLogs.length,
    completionRatePercentage: Math.min(100, Math.round((completedLogs.length / Math.max(1, logs.length)) * 100)),
  };
}
