import React, { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Goal, GoalCategory, GoalStep, SavingsGoal } from '../../domain/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { EmptyState } from '../../components/shared/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { SUGGESTED_STUDENT_GOALS } from '../../db/seed';
import confetti from 'canvas-confetti';
import {
  Target,
  CheckCircle2,
  Plus,
  Trash2,
  PiggyBank,
  Sparkles,
} from 'lucide-react';
import { useUserData } from '../../hooks/useUserData';

export function GoalsPage() {
  const { success, toastWithUndo } = useToast();
  const { currentUser, goals, savingsGoals } = useUserData();

  const todayStr = new Date().toISOString().slice(0, 10);

  // Modal Dialogs
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [goalTitle, setGoalTitle] = useState('');
  const [goalCategory, setGoalCategory] = useState<GoalCategory>('academic');
  const [goalTargetDate, setGoalTargetDate] = useState(todayStr);
  const [goalTarget, setGoalTarget] = useState('');
  const [goalNotes, setGoalNotes] = useState('');
  const [deletingGoal, setDeletingGoal] = useState<Goal | null>(null);

  // Handle Step Toggle
  const handleToggleStep = async (goal: Goal, stepId: string) => {
    const updatedSteps = goal.steps.map(s => (s.id === stepId ? { ...s, isCompleted: !s.isCompleted } : s));
    const completedCount = updatedSteps.filter(s => s.isCompleted).length;
    const progressPercent = updatedSteps.length > 0 ? Math.round((completedCount / updatedSteps.length) * 100) : goal.progressPercent;
    const isCompleted = progressPercent === 100;

    await db.goals.update(goal.id, {
      steps: updatedSteps,
      progressPercent,
      status: isCompleted ? 'completed' : 'active',
      updatedAt: new Date().toISOString(),
    });

    if (isCompleted) {
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.7 } });
      success('Goal Completed!', `Congratulations on completing "${goal.title}"`);
    }
  };

  // Handle Create Goal
  const handleCreateGoal = async () => {
    if (!goalTitle.trim()) return;
    const now = new Date().toISOString();
    const newG: Goal = {
      id: `g_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: currentUser?.id,
      title: goalTitle.trim(),
      category: goalCategory,
      targetDate: goalTargetDate,
      status: 'active',
      progressPercent: 0,
      measurableTarget: goalTarget,
      steps: [
        { id: '1', title: 'Phase 1: Foundation', isCompleted: false },
        { id: '2', title: 'Phase 2: Milestone Execution', isCompleted: false },
      ],
      notes: goalNotes,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await db.goals.add(newG);
    success('Goal added', newG.title);
    setIsAddGoalOpen(false);
    setGoalTitle('');
    setGoalTarget('');
    setGoalNotes('');
  };

  const handleAddSuggestedGoals = async () => {
    const now = new Date().toISOString();
    const newGoals: Goal[] = SUGGESTED_STUDENT_GOALS.map((g, idx) => {
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + g.targetDays);
      return {
        id: `goal_${Date.now()}_${idx}`,
        userId: currentUser?.id,
        title: g.title,
        category: g.category,
        targetDate: targetDate.toISOString().slice(0, 10),
        status: 'active',
        progressPercent: 0,
        measurableTarget: g.measurableTarget,
        currentValue: g.currentValue,
        steps: g.steps,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
    });
    await db.goals.bulkAdd(newGoals);
    success('Goals Added', `Added ${newGoals.length} suggested student goals.`);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Goals Command</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Long-term aspirations • Academic & Financial milestones • Step-by-step checklists
          </p>
        </div>
        <Button size="sm" onClick={() => setIsAddGoalOpen(true)}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          New Goal
        </Button>
      </div>

      {goals.length === 0 ? (
        <div className="space-y-4">
          <EmptyState
            icon={<Target className="w-6 h-6" />}
            title="No goals defined"
            description="Set goals for CGPA targets, hackathon wins, student emergency fund, or internship preparation."
            actionLabel="Define Goal"
            onAction={() => setIsAddGoalOpen(true)}
          />
          <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">Suggested Student Goals</p>
              <p className="text-[11px] text-muted-foreground">
                Add standard goals (CGPA 8.5+, Emergency Fund, Portfolio) with one click.
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={handleAddSuggestedGoals}>
              Add Suggested Goals
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {goals.filter(g => !g.deletedAt).map(goal => {
            const isFinished = goal.status === 'completed' || goal.progressPercent === 100;
            return (
              <Card key={goal.id} className="p-4 space-y-3.5">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline" className="capitalize text-[10px]">
                        {goal.category}
                      </Badge>
                      {isFinished && <Badge variant="success">Completed</Badge>}
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mt-1.5">{goal.title}</h4>
                    {goal.measurableTarget && (
                      <p className="text-xs text-primary font-medium mt-0.5">Target: {goal.measurableTarget}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums">Due: {goal.targetDate}</span>
                </div>

                {/* Progress bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Progress</span>
                    <span className="font-semibold tabular-nums text-foreground">{goal.progressPercent}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${isFinished ? 'bg-emerald-500' : 'bg-primary'}`}
                      style={{ width: `${goal.progressPercent}%` }}
                    />
                  </div>
                </div>

                {/* Checklist Steps */}
                <div className="space-y-1.5 pt-2 border-t border-border">
                  <span className="text-[11px] font-semibold text-muted-foreground block">Action Steps</span>
                  {goal.steps.map(step => (
                    <div key={step.id} className="flex items-center space-x-2 text-xs">
                      <button
                        onClick={() => handleToggleStep(goal, step.id)}
                        className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                          step.isCompleted ? 'bg-primary border-primary text-primary-foreground' : 'border-border'
                        }`}
                      >
                        {step.isCompleted && <CheckCircle2 className="w-3 h-3" />}
                      </button>
                      <span className={step.isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}>
                        {step.title}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => setDeletingGoal(goal)}
                    className="text-muted-foreground hover:text-destructive p-1 rounded transition-colors text-xs flex items-center space-x-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD GOAL */}
      <Modal isOpen={isAddGoalOpen} onClose={() => setIsAddGoalOpen(false)} title="Create New Goal">
        <div className="space-y-3.5">
          <Input
            label="Goal Title"
            placeholder="e.g. Score 8.5 CGPA, Build React Portfolio, Save ₹10k"
            value={goalTitle}
            onChange={e => setGoalTitle(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={goalCategory}
              onChange={e => setGoalCategory(e.target.value as any)}
            >
              <option value="academic">Academic</option>
              <option value="financial">Financial</option>
              <option value="fitness">Fitness</option>
              <option value="career">Career / Coding</option>
              <option value="personal">Personal</option>
            </Select>

            <Input
              label="Target Date"
              type="date"
              value={goalTargetDate}
              onChange={e => setGoalTargetDate(e.target.value)}
            />
          </div>

          <Input
            label="Measurable Target (Optional)"
            placeholder="e.g. 8.5 GPA, ₹10,000, 5 Pull-ups"
            value={goalTarget}
            onChange={e => setGoalTarget(e.target.value)}
          />

          <Textarea
            label="Notes & Strategy"
            placeholder="Why is this goal important and how will you achieve it?"
            value={goalNotes}
            onChange={e => setGoalNotes(e.target.value)}
          />

          <div className="pt-2 flex justify-end space-x-2">
            <Button variant="outline" onClick={() => setIsAddGoalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateGoal} disabled={!goalTitle.trim()}>
              Create Goal
            </Button>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE */}
      <ConfirmModal
        isOpen={!!deletingGoal}
        onClose={() => setDeletingGoal(null)}
        onConfirm={async () => {
          if (!deletingGoal) return;
          const now = new Date().toISOString();
          await db.goals.update(deletingGoal.id, { deletedAt: now });
          toastWithUndo(`Deleted "${deletingGoal.title}"`, async () => {
            await db.goals.update(deletingGoal.id, { deletedAt: null });
          });
          setDeletingGoal(null);
        }}
        title="Delete Goal"
        description={`Are you sure you want to delete "${deletingGoal?.title}"?`}
      />
    </div>
  );
}
