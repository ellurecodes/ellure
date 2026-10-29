import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Habit, HabitLog, FitnessMetricLog } from '../../domain/types';
import { calculateHabitStreak } from '../../domain/habits';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { EmptyState } from '../../components/shared/EmptyState';
import { useToast } from '../../components/ui/Toast';
import {
  HeartPulse,
  Flame,
  CheckCircle2,
  Droplets,
  Moon,
  Footprints,
  Dumbbell,
  Plus,
  Trash2,
  Calendar,
} from 'lucide-react';
import { useUserData } from '../../hooks/useUserData';

export function HabitsPage() {
  const { success, toastWithUndo } = useToast();
  const todayStr = new Date().toISOString().slice(0, 10);

  const {
    currentUser,
    habits,
    habitLogs,
    fitnessMetricLogs: metricLogs,
    settings,
  } = useUserData();

  // Today's metric log
  const todayMetric = useMemo(() => {
    return metricLogs.find(m => m.date === todayStr) || { id: `m_${todayStr}`, date: todayStr };
  }, [metricLogs, todayStr]);

  // Streak calculations map
  const habitStreaks = useMemo(() => {
    const map: Record<string, ReturnType<typeof calculateHabitStreak>> = {};
    for (const h of habits) {
      const logsForH = habitLogs.filter(l => l.habitId === h.id);
      map[h.id] = calculateHabitStreak(logsForH, todayStr);
    }
    return map;
  }, [habits, habitLogs, todayStr]);

  // Modal Dialogs
  const [isAddHabitOpen, setIsAddHabitOpen] = useState(false);
  const [habitName, setHabitName] = useState('');
  const [habitCategory, setHabitCategory] = useState<any>('general');
  const [habitColor, setHabitColor] = useState('#10b981');
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);

  // Toggle Habit completion for today
  const handleToggleHabit = async (habitId: string) => {
    const existingLog = habitLogs.find(l => l.habitId === habitId && l.date === todayStr);
    const newCompleted = !existingLog?.completed;

    if (existingLog) {
      await db.habitLogs.update(existingLog.id, { completed: newCompleted });
    } else {
      await db.habitLogs.add({
        id: `hl_${habitId}_${todayStr}`,
        userId: currentUser?.id,
        habitId,
        date: todayStr,
        completed: true,
      });
    }
  };

  // Create Habit
  const handleCreateHabit = async () => {
    if (!habitName.trim()) return;
    const now = new Date().toISOString();
    const newH: Habit = {
      id: `h_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      name: habitName.trim(),
      category: habitCategory,
      frequency: 'daily',
      color: habitColor,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await db.habits.add(newH);
    success('Habit created', newH.name);
    setIsAddHabitOpen(false);
    setHabitName('');
  };

  // Update daily wellness metric (water, sleep, steps, workout)
  const handleUpdateMetric = async (field: keyof FitnessMetricLog, value: number) => {
    const current = { ...todayMetric, userId: currentUser?.id, [field]: value };
    await db.fitnessMetricLogs.put(current);
  };

  const fitnessToggles = settings?.fitnessToggles || {
    water: true,
    sleep: true,
    workout: true,
    steps: true,
    weight: false,
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Habits & Wellness</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Daily routines • Streak tracking • Zero medical claims or cloud data
          </p>
        </div>
        <Button size="sm" onClick={() => setIsAddHabitOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Habit
        </Button>
      </div>

      {/* Daily Metrics Panel (Toggleable) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        {fitnessToggles.water && (
          <Card className="p-4 bg-sky-500/5 border-sky-500/20">
            <div className="flex items-center justify-between text-sky-600 mb-1.5">
              <span className="text-[11px] font-semibold uppercase">Water Intake</span>
              <Droplets className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xl font-bold tabular-nums">
                {todayMetric.waterGlasses || 0} <span className="text-xs font-normal text-muted-foreground">glasses</span>
              </span>
              <div className="flex space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => handleUpdateMetric('waterGlasses', Math.max(0, (todayMetric.waterGlasses || 0) - 1))}
                >
                  -
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => handleUpdateMetric('waterGlasses', (todayMetric.waterGlasses || 0) + 1)}
                >
                  +
                </Button>
              </div>
            </div>
          </Card>
        )}

        {fitnessToggles.sleep && (
          <Card className="p-4 bg-purple-500/5 border-purple-500/20">
            <div className="flex items-center justify-between text-purple-600 mb-1.5">
              <span className="text-[11px] font-semibold uppercase">Sleep Duration</span>
              <Moon className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xl font-bold tabular-nums">
                {todayMetric.sleepHours || 0} <span className="text-xs font-normal text-muted-foreground">hrs</span>
              </span>
              <div className="flex space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => handleUpdateMetric('sleepHours', Math.max(0, (todayMetric.sleepHours || 0) - 0.5))}
                >
                  -
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => handleUpdateMetric('sleepHours', (todayMetric.sleepHours || 0) + 0.5)}
                >
                  +
                </Button>
              </div>
            </div>
          </Card>
        )}

        {fitnessToggles.workout && (
          <Card className="p-4 bg-rose-500/5 border-rose-500/20">
            <div className="flex items-center justify-between text-rose-600 mb-1.5">
              <span className="text-[11px] font-semibold uppercase">Exercise / Walk</span>
              <Dumbbell className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xl font-bold tabular-nums">
                {todayMetric.workoutMinutes || 0} <span className="text-xs font-normal text-muted-foreground">mins</span>
              </span>
              <div className="flex space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => handleUpdateMetric('workoutMinutes', Math.max(0, (todayMetric.workoutMinutes || 0) - 15))}
                >
                  -
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => handleUpdateMetric('workoutMinutes', (todayMetric.workoutMinutes || 0) + 15)}
                >
                  +
                </Button>
              </div>
            </div>
          </Card>
        )}

        {fitnessToggles.steps && (
          <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
            <div className="flex items-center justify-between text-emerald-600 mb-1.5">
              <span className="text-[11px] font-semibold uppercase">Campus Steps</span>
              <Footprints className="w-4 h-4" />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-xl font-bold tabular-nums">
                {todayMetric.walkSteps || 0}
              </span>
              <div className="flex space-x-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 w-7 p-0"
                  onClick={() => handleUpdateMetric('walkSteps', (todayMetric.walkSteps || 0) + 1000)}
                >
                  +1k
                </Button>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Habit Checklists with Streaks */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Habit Checklists & Streaks</h3>

        {habits.length === 0 ? (
          <EmptyState
            icon={<Flame className="w-6 h-6" />}
            title="No habits tracked"
            description="Build consistent student habits like 2-hour deep study, reading, or morning workouts."
            actionLabel="Add Habit"
            onAction={() => setIsAddHabitOpen(true)}
          />
        ) : (
          <div className="space-y-2.5">
            {habits.map(h => {
              const streak = habitStreaks[h.id] || { currentStreak: 0, longestStreak: 0, completedToday: false };
              return (
                <div
                  key={h.id}
                  className={`flex items-center justify-between p-3.5 rounded-xl border bg-card transition-all ${
                    streak.completedToday ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => handleToggleHabit(h.id)}
                      className={`w-6 h-6 rounded-lg border flex items-center justify-center transition-all ${
                        streak.completedToday
                          ? 'bg-emerald-500 border-emerald-500 text-white shadow-xs'
                          : 'border-border hover:border-emerald-500/60'
                      }`}
                      aria-label="Toggle habit for today"
                    >
                      {streak.completedToday && <CheckCircle2 className="w-4 h-4" />}
                    </button>

                    <div>
                      <span className={`text-xs font-semibold ${streak.completedToday ? 'text-foreground' : 'text-foreground'}`}>
                        {h.name}
                      </span>
                      <span className="block text-[11px] text-muted-foreground capitalize">
                        {h.category} • {h.frequency}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-500 bg-amber-500/10 px-2.5 py-1 rounded-md">
                      <Flame className="w-3.5 h-3.5 fill-amber-500" />
                      <span className="tabular-nums">{streak.currentStreak}d</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        (Best {streak.longestStreak}d)
                      </span>
                    </div>

                    <button
                      onClick={() => setDeletingHabit(h)}
                      className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors"
                      title="Delete habit"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* MODAL: ADD HABIT */}
      <Modal isOpen={isAddHabitOpen} onClose={() => setIsAddHabitOpen(false)} title="Add Daily Habit">
        <div className="space-y-3.5">
          <Input
            label="Habit Name"
            placeholder="e.g. 2-Hour Deep Study, Evening Jog, Read Research Papers"
            value={habitName}
            onChange={e => setHabitName(e.target.value)}
          />

          <Select
            label="Category"
            value={habitCategory}
            onChange={e => setHabitCategory(e.target.value as any)}
          >
            <option value="study">Study & Focus</option>
            <option value="fitness">Fitness & Health</option>
            <option value="mindset">Mindset & Reading</option>
            <option value="general">General</option>
          </Select>

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddHabitOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateHabit} disabled={!habitName.trim()}>
              Create Habit
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        isOpen={!!deletingHabit}
        onClose={() => setDeletingHabit(null)}
        onConfirm={async () => {
          if (!deletingHabit) return;
          await db.habits.delete(deletingHabit.id);
          success('Habit deleted', deletingHabit.name);
          setDeletingHabit(null);
        }}
        title="Delete Habit"
        description={`Are you sure you want to delete "${deletingHabit?.name}"? Its logs will be permanently removed.`}
      />
    </div>
  );
}
