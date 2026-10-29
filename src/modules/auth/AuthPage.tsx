import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { ShieldCheck, Lock, User, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';

export function AuthPage() {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');

  // Login state
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Register state
  const [regUsername, setRegUsername] = useState('');
  const [regDisplayName, setRegDisplayName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regMessage, setRegMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);
    try {
      const res = await login(loginUsername, loginPassword);
      if (!res.success && res.error) {
        setLoginError(res.error);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegMessage(null);
    setIsSubmitting(true);
    try {
      const res = await register(regUsername, regDisplayName, regPassword);
      if (res.success) {
        setRegMessage({ type: 'success', text: res.message || 'Registration submitted for admin approval.' });
        setRegUsername('');
        setRegDisplayName('');
        setRegPassword('');
      } else {
        setRegMessage({ type: 'error', text: res.error || 'Failed to register.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillDemoAdmin = () => {
    setLoginUsername('admin');
    setLoginPassword('admin123');
    setActiveTab('login');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-background text-foreground antialiased selection:bg-primary/20">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-primary flex items-center justify-center text-primary-foreground font-black text-lg mx-auto shadow-md">
            OS
          </div>
          <h1 className="text-2xl font-bold tracking-tight">LifeOS</h1>
          <p className="text-xs text-muted-foreground">
            Personal Command Center & Finance for College Students
          </p>
        </div>

        {/* Auth Box */}
        <Card className="border border-border shadow-xl bg-card">
          <CardContent className="p-6 space-y-5">
            {/* Tabs */}
            <div className="flex border-b border-border p-1 bg-muted/40 rounded-xl">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setLoginError('');
                  setRegMessage(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'login'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setLoginError('');
                  setRegMessage(null);
                }}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  activeTab === 'register'
                    ? 'bg-card text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Register (Pending Approval)
              </button>
            </div>

            {/* TAB 1: LOGIN */}
            {activeTab === 'login' && (
              <form onSubmit={handleLogin} className="space-y-4">
                {loginError && (
                  <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-600 flex items-start space-x-2.5">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{loginError}</span>
                  </div>
                )}

                <Input
                  label="Username"
                  placeholder="e.g. rahul, sneha, admin"
                  value={loginUsername}
                  onChange={e => setLoginUsername(e.target.value)}
                  required
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  value={loginPassword}
                  onChange={e => setLoginPassword(e.target.value)}
                  required
                />

                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  Sign In to LifeOS
                </Button>
              </form>
            )}

            {/* TAB 2: REGISTER */}
            {activeTab === 'register' && (
              <form onSubmit={handleRegister} className="space-y-4">
                {regMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-start space-x-2.5 ${
                      regMessage.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-600'
                    }`}
                  >
                    {regMessage.type === 'success' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    )}
                    <span>{regMessage.text}</span>
                  </div>
                )}

                <Input
                  label="Username"
                  placeholder="e.g. rohit_cs"
                  value={regUsername}
                  onChange={e => setRegUsername(e.target.value)}
                  required
                />

                <Input
                  label="Display Name / Student Name"
                  placeholder="e.g. Rohit Sharma"
                  value={regDisplayName}
                  onChange={e => setRegDisplayName(e.target.value)}
                  required
                />

                <Input
                  label="Password"
                  type="password"
                  placeholder="At least 4 characters"
                  value={regPassword}
                  onChange={e => setRegPassword(e.target.value)}
                  required
                />

                <div className="p-3 bg-muted/40 rounded-xl text-[11px] text-muted-foreground leading-relaxed">
                  <span className="font-semibold text-foreground block mb-0.5">Approval Policy:</span>
                  New student accounts require administrator approval before logging in. Your financial ledgers and academic data will be strictly zero on first login.
                </div>

                <Button type="submit" className="w-full" isLoading={isSubmitting}>
                  Submit for Approval
                </Button>
              </form>
            )}

            {/* Admin Demo Shortcut */}
            <div className="pt-3 border-t border-border flex flex-col items-center justify-center space-y-2">
              <span className="text-[11px] text-muted-foreground">Default Administrator Access:</span>
              <button
                type="button"
                onClick={fillDemoAdmin}
                className="text-xs font-mono text-primary hover:underline bg-primary/10 px-3 py-1 rounded-md"
              >
                admin / admin123
              </button>
            </div>
          </CardContent>
        </Card>

        {/* Zero-Knowledge Privacy Guarantee Banner */}
        <div className="p-3.5 rounded-xl border border-border bg-card/60 text-[11px] text-muted-foreground flex items-start space-x-2.5">
          <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold text-foreground block">Strict Admin Isolation:</span>
            Administrators can only approve, reject, or delete accounts. Administrators have zero access to view students' private transactions, balances, or academic grades.
          </div>
        </div>
      </div>
    </div>
  );
}
