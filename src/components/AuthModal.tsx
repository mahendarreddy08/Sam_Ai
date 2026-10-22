// src/components/AuthModal.tsx - Glassmorphic Authentication & Account Modal
import React, { useState } from "react";
import { X, Lock, Mail, User as UserIcon, ShieldCheck, Sparkles, LogIn, UserPlus, Cloud, Check } from "lucide-react";
import { loginWithGoogle, loginAsGuest, loginWithEmail, registerWithEmail, logoutUser } from "../services/firebase";

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: {
    uid: string;
    email: string | null;
    displayName: string | null;
    isAnonymous: boolean;
  } | null;
  onAuthSuccess: (msg: string) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onAuthSuccess,
}) => {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const user = await loginWithGoogle();
      onAuthSuccess(`Welcome, ${user.displayName || "Explorer"}!`);
      onClose();
    } catch (err: any) {
      console.warn("Google sign-in error:", err);
      setError(err?.message || "Google sign-in failed. You can also sign in as Guest.");
    } finally {
      setLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginAsGuest();
      onAuthSuccess("Signed in as Guest Explorer. Your data is isolated in Cloud Firestore!");
      onClose();
    } catch (err: any) {
      console.warn("Guest sign-in error:", err);
      setError(err?.message || "Guest sign-in failed.");
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError("Please fill in email and password.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (mode === "signin") {
        const user = await loginWithEmail(email, password);
        onAuthSuccess(`Welcome back, ${user.displayName || user.email}!`);
      } else {
        const user = await registerWithEmail(email, password, displayName);
        onAuthSuccess(`Account created for ${user.displayName || user.email}!`);
      }
      onClose();
    } catch (err: any) {
      console.warn("Email auth error:", err);
      if (err?.code === "auth/invalid-credential" || err?.code === "auth/wrong-password") {
        setError("Invalid email or password.");
      } else if (err?.code === "auth/email-already-in-use") {
        setError("This email is already registered. Try signing in.");
      } else if (err?.code === "auth/weak-password") {
        setError("Password should be at least 6 characters.");
      } else {
        setError(err?.message || "Authentication failed. Try Guest mode.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSignOut = async () => {
    setLoading(true);
    try {
      await logoutUser();
      onAuthSuccess("Signed out successfully.");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Failed to sign out.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-md bg-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl relative">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
        >
          <X size={18} />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-cyan-400 to-sky-600 flex items-center justify-center text-slate-950 shadow-md">
            <Cloud size={20} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              {currentUser ? "Account & Cloud Sync" : "Sign In to S.A.M."}
            </h2>
            <p className="text-xs text-slate-400">
              {currentUser
                ? "Your notes, tasks, and memory sync to Firestore"
                : "Persist your data across devices securely"}
            </p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/50 border border-rose-800/60 text-xs text-rose-300">
            {error}
          </div>
        )}

        {currentUser ? (
          /* Signed In State */
          <div className="space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/[0.08] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Status</span>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-950/80 border border-emerald-600/40 text-emerald-300 flex items-center gap-1">
                  <Check size={10} /> Authenticated
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Name</span>
                <span className="text-xs font-medium text-white">{currentUser.displayName || "Explorer"}</span>
              </div>
              {currentUser.email && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Email</span>
                  <span className="text-xs font-mono text-slate-300">{currentUser.email}</span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Account Type</span>
                <span className="text-xs text-cyan-400 capitalize">
                  {currentUser.isAnonymous ? "Guest Session" : "Registered User"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">Firestore ID</span>
                <span className="text-[10px] font-mono text-slate-500 truncate max-w-[200px]">{currentUser.uid}</span>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-cyan-300 flex items-start gap-2">
              <ShieldCheck size={16} className="shrink-0 mt-0.5 text-cyan-400" />
              <span>
                Zero-Trust Firestore security rules protect your records. Only you have read and write permission to your private documents.
              </span>
            </div>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-rose-400 border border-rose-900/40 text-xs font-semibold transition cursor-pointer"
            >
              Sign Out
            </button>
          </div>
        ) : (
          /* Sign In / Sign Up Forms */
          <div className="space-y-4">
            {/* Quick One-Tap Sign In Options */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={handleGoogleLogin}
                disabled={loading}
                className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-white/[0.08] text-xs font-medium text-white flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#EA4335"
                    d="M12 5c1.6 0 3 .6 4.1 1.6l3.1-3.1C17.3 1.7 14.8 1 12 1 7.5 1 3.7 3.6 1.9 7.3l3.7 2.9C6.5 7.4 9 5 12 5z"
                  />
                  <path
                    fill="#4285F4"
                    d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.8z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.6 14.8c-.2-.7-.4-1.5-.4-2.8s.2-2.1.4-2.8L1.9 6.3C.7 8.7 0 10.3 0 12s.7 3.3 1.9 5.7l3.7-2.9z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3 0-5.5-2-6.4-4.8L1.9 16.4C3.7 20.1 7.5 23 12 23z"
                  />
                </svg>
                <span>Google</span>
              </button>

              <button
                onClick={handleGuestLogin}
                disabled={loading}
                className="py-2.5 px-3 rounded-xl bg-cyan-950/40 hover:bg-cyan-900/50 border border-cyan-800/50 text-xs font-medium text-cyan-300 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
              >
                <Sparkles size={14} className="text-cyan-400" />
                <span>Instant Guest</span>
              </button>
            </div>

            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-slate-800" />
              <span className="text-[10px] text-slate-500 uppercase tracking-widest">or email</span>
              <div className="flex-1 h-px bg-slate-800" />
            </div>

            <form onSubmit={handleEmailAuth} className="space-y-3">
              {mode === "signup" && (
                <div>
                  <label className="text-[11px] text-slate-400 mb-1 block">Full Name</label>
                  <div className="relative">
                    <UserIcon size={14} className="absolute left-3 top-3 text-slate-500" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Mahendar Reddy"
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Email Address</label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] text-slate-400 mb-1 block">Password</label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-3 text-slate-500" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold transition cursor-pointer flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20 active:scale-98"
              >
                {mode === "signin" ? <LogIn size={14} /> : <UserPlus size={14} />}
                <span>{loading ? "Processing..." : mode === "signin" ? "Sign In" : "Create Account"}</span>
              </button>
            </form>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                }}
                className="text-xs text-slate-400 hover:text-cyan-400 transition cursor-pointer"
              >
                {mode === "signin" ? "Don't have an account? Sign Up" : "Already have an account? Sign In"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
