import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/shared/EmptyState';
import { useToast } from '../../components/ui/Toast';
import { Trash2, RotateCcw, AlertTriangle } from 'lucide-react';
import { MoneyDisplay } from '../../components/shared/MoneyDisplay';

export function TrashPage() {
  const { success, error } = useToast();

  const transactions = useLiveQuery(() => db.transactions.toArray()) || [];
  const platforms = useLiveQuery(() => db.platforms.toArray()) || [];
  const tasks = useLiveQuery(() => db.academicTasks.toArray()) || [];
  const goals = useLiveQuery(() => db.goals.toArray()) || [];

  const deletedTransactions = useMemo(() => transactions.filter(t => !!t.deletedAt), [transactions]);
  const deletedPlatforms = useMemo(() => platforms.filter(p => !!p.deletedAt), [platforms]);
  const deletedTasks = useMemo(() => tasks.filter(t => !!t.deletedAt), [tasks]);
  const deletedGoals = useMemo(() => goals.filter(g => !!g.deletedAt), [goals]);

  const totalDeletedCount =
    deletedTransactions.length +
    deletedPlatforms.length +
    deletedTasks.length +
    deletedGoals.length;

  // Restore Handlers
  const handleRestoreTransaction = async (id: string) => {
    await db.transactions.update(id, { deletedAt: null });
    success('Transaction restored to ledger');
  };

  const handlePermanentDeleteTransaction = async (id: string) => {
    await db.transactions.delete(id);
    success('Transaction permanently deleted');
  };

  const handleRestoreTask = async (id: string) => {
    await db.academicTasks.update(id, { deletedAt: null });
    success('Academic task restored');
  };

  const handleRestoreGoal = async (id: string) => {
    await db.goals.update(id, { deletedAt: null });
    success('Goal restored');
  };

  // Empty Trash
  const handleEmptyTrash = async () => {
    await Promise.all([
      db.transactions.bulkDelete(deletedTransactions.map(t => t.id)),
      db.platforms.bulkDelete(deletedPlatforms.map(p => p.id)),
      db.academicTasks.bulkDelete(deletedTasks.map(t => t.id)),
      db.goals.bulkDelete(deletedGoals.map(g => g.id)),
    ]);
    success('Trash emptied', 'All deleted items have been permanently removed.');
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Trash & Recycle Bin</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Soft-deleted items are excluded from balances and reports. Restore them anytime.
          </p>
        </div>

        {totalDeletedCount > 0 && (
          <Button size="sm" variant="destructive" onClick={handleEmptyTrash}>
            <Trash2 className="w-3.5 h-3.5 mr-1.5" />
            Empty Trash Permanently
          </Button>
        )}
      </div>

      {totalDeletedCount === 0 ? (
        <EmptyState
          icon={<Trash2 className="w-6 h-6" />}
          title="Trash is clean"
          description="Any records or tasks you delete will appear here first with an option to restore."
        />
      ) : (
        <div className="space-y-6">
          {/* Deleted Transactions */}
          {deletedTransactions.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Deleted Ledger Transactions ({deletedTransactions.length})</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {deletedTransactions.map(t => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-foreground">{t.title}</span>
                      <span className="text-[11px] text-muted-foreground block">
                        Deleted: {t.deletedAt?.slice(0, 10)} • Amount:{' '}
                        {'amountPaise' in t ? `₹${(t.amountPaise / 100).toFixed(2)}` : ''}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button size="sm" variant="outline" onClick={() => handleRestoreTransaction(t.id)}>
                        <RotateCcw className="w-3.5 h-3.5 mr-1" />
                        Restore
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => handlePermanentDeleteTransaction(t.id)}
                      >
                        Delete Forever
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Deleted Academic Tasks */}
          {deletedTasks.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Deleted Academic Tasks ({deletedTasks.length})</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {deletedTasks.map(task => (
                  <div key={task.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-foreground">{task.title}</span>
                      <span className="text-[11px] text-muted-foreground block">Due: {task.dueDate}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleRestoreTask(task.id)}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Restore
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Deleted Goals */}
          {deletedGoals.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Deleted Goals ({deletedGoals.length})</CardTitle>
              </CardHeader>
              <CardContent className="divide-y divide-border">
                {deletedGoals.map(goal => (
                  <div key={goal.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div>
                      <span className="font-semibold text-foreground">{goal.title}</span>
                      <span className="text-[11px] text-muted-foreground block">Category: {goal.category}</span>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleRestoreGoal(goal.id)}>
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Restore
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
