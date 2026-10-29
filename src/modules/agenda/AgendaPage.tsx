import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/shared/EmptyState';
import { useToast } from '../../components/ui/Toast';
import {
  CalendarCheck2,
  BookOpen,
  Clock,
  Flame,
  Target,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { useUserData } from '../../hooks/useUserData';

export function AgendaPage() {
  const { success, toastWithUndo } = useToast();
  const todayStr = new Date().toISOString().slice(0, 10);

  const {
    currentUser,
    academicTasks,
    recurringTransactions: recurring,
    habits,
    habitLogs,
    goals,
  } = useUserData();

  // 1. Today's Academic Tasks
  const todayTasks = useMemo(() => {
    return academicTasks.filter(t => !t.deletedAt && t.dueDate === todayStr);
  }, [academicTasks, todayStr]);

  // 2. Upcoming / Due Bills Today
  const dueBills = useMemo(() => {
    return recurring.filter(r => !r.deletedAt && r.isActive && r.nextDueDate <= todayStr);
  }, [recurring, todayStr]);

  // 3. Habits due today
  const todayHabits = useMemo(() => {
    return habits.map(h => {
      const isDone = habitLogs.some(l => l.habitId === h.id && l.date === todayStr && l.completed);
      return { ...h, isDone };
    });
  }, [habits, habitLogs, todayStr]);

  // 4. Incomplete Goal Steps
  const activeGoalSteps = useMemo(() => {
    const list: { goalTitle: string; stepId: string; stepTitle: string; goalId: string }[] = [];
    for (const g of goals) {
      if (g.deletedAt || g.status === 'completed') continue;
      for (const s of g.steps) {
        if (!s.isCompleted) {
          list.push({ goalTitle: g.title, stepId: s.id, stepTitle: s.title, goalId: g.id });
        }
      }
    }
    return list.slice(0, 4);
  }, [goals]);

  // Handle Complete Academic Task
  const handleToggleTask = async (taskId: string, currentStatus: string) => {
    const isNowDone = currentStatus !== 'done';
    const now = new Date().toISOString();
    await db.academicTasks.update(taskId, {
      status: isNowDone ? 'done' : 'todo',
      completedAt: isNowDone ? now : undefined,
    });
    success(isNowDone ? 'Task marked complete' : 'Task reopened');
  };

  // Handle Toggle Habit
  const handleToggleHabit = async (habitId: string, currentlyDone: boolean) => {
    const existingLog = habitLogs.find(l => l.habitId === habitId && l.date === todayStr);
    if (existingLog) {
      await db.habitLogs.update(existingLog.id, { completed: !currentlyDone });
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

  const totalAgendaItems = todayTasks.length + dueBills.length + todayHabits.length;
  const completedAgendaItems =
    todayTasks.filter(t => t.status === 'done').length +
    todayHabits.filter(h => h.isDone).length;

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Unified Daily Agenda</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Merged view of today's academic tasks, bill deadlines, goal actions, and habits ({todayStr})
          </p>
        </div>
        <div className="flex items-center space-x-2 text-xs font-semibold bg-primary/10 text-primary px-3 py-1.5 rounded-lg">
          <Sparkles className="w-4 h-4" />
          <span>
            {completedAgendaItems} of {totalAgendaItems} daily items completed
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION 1: ACADEMIC TASKS DUE TODAY */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center space-x-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Academic Tasks Due Today
              </h3>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">{todayTasks.length}</span>
          </div>

          {todayTasks.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No assignments or lab submissions due today!</p>
          ) : (
            <div className="space-y-2">
              {todayTasks.map(task => {
                const isDone = task.status === 'done';
                return (
                  <div
                    key={task.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border bg-card transition-all ${
                      isDone ? 'opacity-60 border-border' : 'border-border'
                    }`}
                  >
                    <div className="flex items-center space-x-2.5">
                      <button
                        onClick={() => handleToggleTask(task.id, task.status)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border'
                        }`}
                      >
                        {isDone && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      <span className={`text-xs font-medium ${isDone ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                        {task.title}
                      </span>
                    </div>
                    <Badge variant={task.priority === 'urgent' ? 'destructive' : 'secondary'} className="text-[10px]">
                      {task.priority}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* SECTION 2: HABIT CHECKLIST */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center space-x-2">
              <Flame className="w-4 h-4 text-amber-500" />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Today's Habit Checklist
              </h3>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">{todayHabits.length}</span>
          </div>

          {todayHabits.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No daily habits configured yet.</p>
          ) : (
            <div className="space-y-2">
              {todayHabits.map(h => (
                <div
                  key={h.id}
                  className={`flex items-center justify-between p-2.5 rounded-lg border bg-card transition-all ${
                    h.isDone ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-border'
                  }`}
                >
                  <div className="flex items-center space-x-2.5">
                    <button
                      onClick={() => handleToggleHabit(h.id, h.isDone)}
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        h.isDone ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-border'
                      }`}
                    >
                      {h.isDone && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <span className="text-xs font-medium text-foreground">{h.name}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] capitalize">
                    {h.category}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* SECTION 3: BILLS & RECURRING REMINDERS */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center space-x-2">
              <Clock className="w-4 h-4 text-rose-500" />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Upcoming / Due Bills & Subscriptions
              </h3>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">{dueBills.length}</span>
          </div>

          {dueBills.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">No recurring bills due today.</p>
          ) : (
            <div className="space-y-2">
              {dueBills.map(b => (
                <div key={b.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                  <div>
                    <span className="text-xs font-medium text-foreground">{b.title}</span>
                    <span className="block text-[11px] text-muted-foreground">Due: {b.nextDueDate}</span>
                  </div>
                  <span className="text-xs font-bold tabular-nums">₹{(b.amountPaise / 100).toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* SECTION 4: GOAL ACTION STEPS */}
        <Card className="p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center space-x-2">
              <Target className="w-4 h-4 text-purple-500" />
              <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Active Goal Steps
              </h3>
            </div>
            <span className="text-[11px] font-mono text-muted-foreground">{activeGoalSteps.length}</span>
          </div>

          {activeGoalSteps.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">All goal steps completed or no goals active.</p>
          ) : (
            <div className="space-y-2">
              {activeGoalSteps.map(step => (
                <div key={step.stepId} className="p-2.5 rounded-lg border border-border bg-card">
                  <span className="text-xs font-medium text-foreground block">{step.stepTitle}</span>
                  <span className="text-[10px] text-primary block mt-0.5">Goal: {step.goalTitle}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
