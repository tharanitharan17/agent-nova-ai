import React, { useState } from 'react';
import { Sparkles, LockKeyhole, Mail, User, ArrowRight, Loader2 } from 'lucide-react';
import { motion } from 'motion/react';
import { login, signup, type AuthUser } from '../lib/api';

interface AuthPageProps {
  onAuthenticated: (user: AuthUser) => void;
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const update = (field: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setForm(current => ({ ...current, [field]: event.target.value }));
    setError('');
  };

  const validate = () => {
    if (mode === 'signup' && form.name.trim().length < 2) return 'Name must be at least 2 characters.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Enter a valid email address.';
    if (form.password.length < 8) return 'Password must be at least 8 characters.';
    if (mode === 'signup' && (!/[A-Za-z]/.test(form.password) || !/\d/.test(form.password))) {
      return 'Password must include a letter and number.';
    }
    return '';
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate();
    if (validationError) return setError(validationError);
    setIsLoading(true);
    setError('');
    try {
      const result = mode === 'login'
        ? await login(form.email, form.password)
        : await signup(form.name, form.email, form.password);
      onAuthenticated(result.user);
    } catch (requestError) {
      setError((requestError as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(current => current === 'login' ? 'signup' : 'login');
    setError('');
    setForm({ name: '', email: '', password: '' });
  };

  return (
    <div className="min-h-screen bg-[#090b11] text-slate-100 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-indigo-900/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-cyan-950/20 rounded-full blur-[140px]" />
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md z-10">
        <div className="flex items-center justify-center space-x-2 mb-8">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-500/10">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-2xl tracking-wide">NOVA</span>
        </div>

        <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl backdrop-blur-xl shadow-2xl p-7">
          <div className="mb-6">
            <p className="text-[10px] font-mono tracking-[0.25em] text-cyan-400 uppercase mb-2">Secure Access</p>
            <h1 className="text-2xl font-display font-bold text-white">{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
            <p className="text-sm text-slate-400 mt-2">{mode === 'login' ? 'Sign in to continue to your Agent Workspace.' : 'Start building your autonomous goal system.'}</p>
          </div>

          <form onSubmit={submit} className="space-y-4" noValidate>
            {mode === 'signup' && (
              <label className="block">
                <span className="text-xs text-slate-400">Name</span>
                <div className="mt-1.5 flex items-center bg-slate-950/60 border border-slate-800 rounded-xl px-3 focus-within:border-cyan-500/50">
                  <User className="w-4 h-4 text-slate-500" />
                  <input aria-label="Name" value={form.name} onChange={update('name')} className="w-full bg-transparent px-3 py-3 text-sm outline-none" autoComplete="name" />
                </div>
              </label>
            )}
            <label className="block">
              <span className="text-xs text-slate-400">Email</span>
              <div className="mt-1.5 flex items-center bg-slate-950/60 border border-slate-800 rounded-xl px-3 focus-within:border-cyan-500/50">
                <Mail className="w-4 h-4 text-slate-500" />
                <input aria-label="Email" type="email" value={form.email} onChange={update('email')} className="w-full bg-transparent px-3 py-3 text-sm outline-none" autoComplete="email" />
              </div>
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Password</span>
              <div className="mt-1.5 flex items-center bg-slate-950/60 border border-slate-800 rounded-xl px-3 focus-within:border-cyan-500/50">
                <LockKeyhole className="w-4 h-4 text-slate-500" />
                <input aria-label="Password" type="password" value={form.password} onChange={update('password')} className="w-full bg-transparent px-3 py-3 text-sm outline-none" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
              </div>
            </label>

            {error && <div role="alert" className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/20 rounded-lg px-3 py-2.5">{error}</div>}

            <button disabled={isLoading} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-500 to-indigo-600 text-white font-semibold text-sm py-3 rounded-xl disabled:opacity-60">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <>{mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight className="w-4 h-4" /></>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800 text-center text-sm text-slate-400">
            {mode === 'login' ? 'New to Nova?' : 'Already have an account?'}
            <button type="button" onClick={switchMode} className="ml-2 text-cyan-400 hover:text-cyan-300 font-medium">
              {mode === 'login' ? 'Create account' : 'Sign in'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

