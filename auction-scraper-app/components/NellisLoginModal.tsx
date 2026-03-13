"use client";

import { useState } from "react";
import { X, LogIn, Lock, Mail, Eye, EyeOff, ShieldCheck, AlertTriangle } from "lucide-react";

interface NellisLoginModalProps {
  onClose: () => void;
  onLoginSuccess: (displayName: string) => void;
}

export function NellisLoginModal({ onClose, onLoginSuccess }: NellisLoginModalProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/nellis-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "Login failed. Check your credentials.");
      } else {
        onLoginSuccess(data.displayName ?? email.split("@")[0]);
        onClose();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-primary/10 border border-primary/30 rounded-lg flex items-center justify-center">
              <LogIn className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Connect Nellis Account</h2>
              <p className="text-xs text-muted-foreground">Sign in with your Nellis Auction credentials</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Security notice */}
        <div className="mx-5 mt-4 flex items-start gap-2.5 bg-primary/5 border border-primary/20 rounded-lg p-3">
          <ShieldCheck className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            Your credentials are used once to obtain a session token, then immediately discarded.
            They are never stored anywhere. The session cookie is HTTP-only and expires in 7 days.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="nellis-email">
              Email Address
            </label>
            <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2.5 focus-within:border-primary/40 transition-colors">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                id="nellis-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoComplete="email"
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground w-full focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-foreground" htmlFor="nellis-password">
              Password
            </label>
            <div className="flex items-center gap-2 bg-muted border border-border rounded-lg px-3 py-2.5 focus-within:border-primary/40 transition-colors">
              <Lock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <input
                id="nellis-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Your Nellis password"
                required
                autoComplete="current-password"
                className="bg-transparent text-sm text-foreground placeholder:text-muted-foreground w-full focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-primary-foreground font-semibold text-sm rounded-lg py-2.5 transition-colors"
          >
            {loading ? (
              <>
                <span className="w-4 h-4 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                Signing in via Playwright...
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                Sign In to Nellis
              </>
            )}
          </button>

          <p className="text-xs text-muted-foreground text-center">
            Don&apos;t have an account?{" "}
            <a
              href="https://www.nellisauction.com/register"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              Register at Nellis
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}
