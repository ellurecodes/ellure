import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { User } from '../../domain/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { ConfirmModal } from '../../components/shared/ConfirmModal';
import { useToast } from '../../components/ui/Toast';
import {
  ShieldAlert,
  Users,
  CheckCircle2,
  XCircle,
  Trash2,
  Lock,
  UserCheck,
  UserX,
  AlertTriangle,
} from 'lucide-react';

export function AdminPortalPage() {
  const { currentUser, approveUser, rejectUser, deleteUser } = useAuth();
  const { success, error } = useToast();

  const users = useLiveQuery(() => db.users.toArray()) || [];
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  if (currentUser?.role !== 'admin') {
    return (
      <div className="p-8 text-center text-xs text-rose-500">
        Access Denied. Administrator role required.
      </div>
    );
  }

  const handleApprove = async (user: User) => {
    await approveUser(user.id);
    success('User Approved', `${user.displayName} (${user.username}) can now sign in.`);
  };

  const handleReject = async (user: User) => {
    await rejectUser(user.id);
    success('User Rejected', `${user.displayName} (${user.username}) access revoked.`);
  };

  const handleDelete = async () => {
    if (!deletingUser) return;
    if (deletingUser.id === currentUser.id) {
      error('Action Denied', 'You cannot delete the active administrator account.');
      setDeletingUser(null);
      return;
    }
    await deleteUser(deletingUser.id);
    success('Account Deleted', `Account ${deletingUser.username} was permanently removed.`);
    setDeletingUser(null);
  };

  const pendingUsers = users.filter(u => u.status === 'pending');
  const activeUsers = users.filter(u => u.status === 'approved' && u.role !== 'admin');
  const rejectedUsers = users.filter(u => u.status === 'rejected');

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-border pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Administrator Access Portal</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Manage user login access (Accept, Reject, Delete) • Strict privacy isolation
          </p>
        </div>
        <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs px-3 py-1 font-semibold">
          Root Administrator
        </Badge>
      </div>

      {/* STRICT ZERO-KNOWLEDGE PRIVACY RESTRICTION NOTICE */}
      <Card className="border-border bg-muted/40">
        <CardContent className="p-4 flex items-start space-x-3 text-xs">
          <ShieldAlert className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h3 className="font-semibold text-foreground">Zero-Knowledge Student Privacy Policy</h3>
            <p className="text-muted-foreground leading-relaxed">
              In accordance with local-first personal productivity principles, administrators are strictly restricted from inspecting, viewing, or querying any user's private financial balances, expense logs, earning records, academic course marks, or personal habits.
            </p>
            <p className="text-muted-foreground font-medium">
              You may only <strong>Accept</strong> or <strong>Reject</strong> access requests, or <strong>Delete</strong> accounts.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* User Statistics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <Card className="p-4 bg-amber-500/5 border-amber-500/20">
          <span className="text-[11px] font-semibold text-amber-600 uppercase">Pending Approvals</span>
          <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">{pendingUsers.length}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Waiting for administrator decision</p>
        </Card>

        <Card className="p-4 bg-emerald-500/5 border-emerald-500/20">
          <span className="text-[11px] font-semibold text-emerald-600 uppercase">Approved Students</span>
          <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">{activeUsers.length}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Full access to their private local app</p>
        </Card>

        <Card className="p-4 bg-rose-500/5 border-rose-500/20">
          <span className="text-[11px] font-semibold text-rose-600 uppercase">Rejected / Blocked</span>
          <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">{rejectedUsers.length}</div>
          <p className="text-[10px] text-muted-foreground mt-0.5">Access prohibited</p>
        </Card>
      </div>

      {/* User Directory Table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Registered Accounts ({users.length})</CardTitle>
          <CardDescription>
            Approve or reject student access requests. Click 'Delete' to permanently remove an account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border border-border rounded-xl overflow-hidden bg-card">
            <table className="w-full text-left text-xs">
              <thead className="bg-muted/50 border-b border-border text-muted-foreground uppercase text-[10px] font-semibold">
                <tr>
                  <th className="py-2.5 px-3.5">Student / User</th>
                  <th className="py-2.5 px-3.5">Username</th>
                  <th className="py-2.5 px-3.5">Role</th>
                  <th className="py-2.5 px-3.5">Registration Date</th>
                  <th className="py-2.5 px-3.5 text-center">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Access Decisions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {users.map(u => {
                  const isCurrentAdmin = u.id === currentUser.id;
                  return (
                    <tr key={u.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-3.5 font-medium text-foreground">
                        {u.displayName}
                        {isCurrentAdmin && (
                          <Badge variant="outline" className="ml-2 text-[10px] py-0 px-1">
                            You
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-3.5 font-mono text-muted-foreground">@{u.username}</td>
                      <td className="py-3 px-3.5">
                        <Badge variant={u.role === 'admin' ? 'secondary' : 'outline'} className="capitalize">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3 px-3.5 text-muted-foreground tabular-nums">
                        {u.createdAt?.slice(0, 10)}
                      </td>
                      <td className="py-3 px-3.5 text-center">
                        <Badge
                          variant={
                            u.status === 'approved'
                              ? 'success'
                              : u.status === 'rejected'
                              ? 'destructive'
                              : 'warning'
                          }
                        >
                          {u.status}
                        </Badge>
                      </td>
                      <td className="py-3 px-3.5 text-right">
                        {!isCurrentAdmin ? (
                          <div className="flex items-center justify-end space-x-2">
                            {u.status !== 'approved' && (
                              <Button
                                size="sm"
                                variant="success"
                                className="h-7 px-2.5 text-xs"
                                onClick={() => handleApprove(u)}
                              >
                                <UserCheck className="w-3.5 h-3.5 mr-1" />
                                Accept
                              </Button>
                            )}
                            {u.status !== 'rejected' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 px-2.5 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-500/10"
                                onClick={() => handleReject(u)}
                              >
                                <UserX className="w-3.5 h-3.5 mr-1" />
                                Reject
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-destructive hover:bg-destructive/10"
                              onClick={() => setDeletingUser(u)}
                              title="Delete account"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-muted-foreground font-mono">Protected</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={!!deletingUser}
        onClose={() => setDeletingUser(null)}
        onConfirm={handleDelete}
        title="Delete User Account"
        description={`Are you sure you want to delete ${deletingUser?.displayName} (@${deletingUser?.username})? Their account login will be permanently removed.`}
      />
    </div>
  );
}
