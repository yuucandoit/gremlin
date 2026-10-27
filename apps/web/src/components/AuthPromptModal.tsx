'use client';

import { useState } from 'react';
import { AlertCircle, Check, Eye, EyeOff, KeyRound, Lock, LogIn, RefreshCw, Sparkles, X } from 'lucide-react';
import { dismissAuthPrompt, submitAuthLogin } from '../lib/api';

interface AuthPromptModalProps {
  runId: string;
  url?: string;
  message?: string;
  onSuccess?: () => void;
  onClose?: () => void;
}

export function AuthPromptModal({
  runId,
  url,
  message,
  onSuccess,
  onClose,
}: AuthPromptModalProps) {
  const [emailOrUsername, setEmailOrUsername] = useState('admin@glitchmart.com');
  const [password, setPassword] = useState('SuperSecret123!');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const result = await submitAuthLogin(runId, {
        emailOrUsername: emailOrUsername.trim(),
        password: password.trim(),
      });

      if (result.success) {
        onSuccess?.();
      } else {
        setError(result.message || 'Login gagal.');
      }
    } catch (err: any) {
      setError(err?.message || 'Gagal mengirim form login ke browser.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    try {
      await dismissAuthPrompt(runId);
      onClose?.();
    } catch {
      onClose?.();
    }
  };

  const handleApplyPreset = () => {
    setEmailOrUsername('admin@glitchmart.com');
    setPassword('SuperSecret123!');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Form Login Terdeteksi
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {message || 'Aplikasi memerlukan otentikasi akun untuk melanjutkan alur pengujian.'}
              </p>
            </div>
          </div>

          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Lewati / Tutup"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {url && (
          <div className="px-3 py-1.5 rounded-lg bg-slate-950/80 border border-slate-800 text-[11px] font-mono text-slate-400 truncate">
            URL: <span className="text-sky-400 underline">{url}</span>
          </div>
        )}

        {/* Error notification */}
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-900 text-rose-300 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>Email atau Username</span>
              <button
                type="button"
                onClick={handleApplyPreset}
                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-normal flex items-center gap-1 cursor-pointer"
              >
                <Sparkles className="w-3 h-3" /> Isi GlitchMart Demo
              </button>
            </label>
            <input
              type="text"
              required
              value={emailOrUsername}
              onChange={(e) => setEmailOrUsername(e.target.value)}
              placeholder="admin@glitchmart.com"
              className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-600 outline-none transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-950 border border-slate-800 focus:border-amber-400 rounded-xl px-3.5 py-2.5 pr-10 text-xs text-white placeholder-slate-600 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-2.5 text-slate-500 hover:text-slate-300 transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2">
            <button
              type="submit"
              disabled={submitting || !emailOrUsername.trim() || !password.trim()}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-amber-500/20 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Mengisi & Memverifikasi...
                </>
              ) : (
                <>
                  <LogIn className="w-3.5 h-3.5" /> Masuk & Lanjutkan Pengujian
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDismiss}
              disabled={submitting}
              className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs rounded-xl transition cursor-pointer"
            >
              Lewati (Uji Tanpa Login)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

