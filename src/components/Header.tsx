import React, { useState, useEffect } from "react";
import { Sparkles, Sliders, CheckSquare, Download, Trash2, MessageSquare, ChevronUp, ChevronDown, Globe, Clock, Cloud, User, CheckCircle2 } from "lucide-react";
import { AssistantState, LanguageMode } from "../types";

interface HeaderProps {
  state: AssistantState;
  hasApiKey: boolean;
  languageMode: LanguageMode;
  onChangeLanguage: (lang: LanguageMode) => void;
  tasksCount: number;
  notesCount: number;
  activeTimersCount: number;
  isTranscriptOpen: boolean;
  currentUser: {
    uid: string;
    email: string | null;
    displayName: string | null;
    isAnonymous: boolean;
  } | null;
  isSyncing: boolean;
  onOpenAuth: () => void;
  onToggleTranscript: () => void;
  onOpenTools: () => void;
  onOpenSettings: () => void;
  onClearChat: () => void;
  onDownloadTranscript: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  state,
  hasApiKey,
  languageMode,
  onChangeLanguage,
  tasksCount,
  notesCount,
  activeTimersCount,
  isTranscriptOpen,
  currentUser,
  isSyncing,
  onOpenAuth,
  onToggleTranscript,
  onOpenTools,
  onOpenSettings,
  onClearChat,
  onDownloadTranscript,
}) => {
  const getStatusColor = () => {
    switch (state) {
      case "listening":
        return "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,1)]";
      case "speaking":
        return "bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,1)]";
      case "thinking":
        return "bg-purple-400 shadow-[0_0_10px_rgba(192,132,252,1)]";
      case "connecting":
        return "bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,1)]";
      case "error":
        return "bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,1)]";
      default:
        return "bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]";
    }
  };

  const [currentClock, setCurrentClock] = useState(() => {
    try {
      return new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(new Date());
    } catch {
      return "";
    }
  });

  useEffect(() => {
    const timer = setInterval(() => {
      try {
        setCurrentClock(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            minute: "2-digit",
            hour12: true,
          }).format(new Date())
        );
      } catch {}
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  const totalProductivityCount = tasksCount + notesCount + activeTimersCount;

  return (
    <header className="relative z-30 flex items-center justify-between px-3 sm:px-6 py-2.5 sm:py-3 border-b border-white/[0.06] bg-slate-950/70 backdrop-blur-2xl">
      {/* Brand Identity & Live Status */}
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-cyan-400 via-sky-500 to-purple-600 flex items-center justify-center font-bold text-slate-950 shadow-[0_0_20px_rgba(6,182,212,0.5)]">
          <Sparkles size={15} className="text-slate-950" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-semibold tracking-wide text-white">S.A.M.</h1>
            <span className="text-slate-700 font-mono text-xs">/</span>
            <div className="flex items-center gap-1.5">
              <span className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${getStatusColor()}`} />
              <span className="text-[11px] font-medium text-slate-300 capitalize tracking-wide">
                {state === "listening"
                  ? "Listening"
                  : state === "speaking"
                  ? "Speaking"
                  : state === "thinking"
                  ? "Thinking"
                  : state === "connecting"
                  ? "Connecting"
                  : state === "error"
                  ? "Offline"
                  : "Ready"}
              </span>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 hidden lg:block tracking-wide">
            Multilingual Voice Assistant
          </p>
        </div>
        {currentClock && (
          <div className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900/60 border border-white/[0.08] text-[11px] font-mono text-slate-300 ml-1">
            <Clock size={12} className="text-sky-400" />
            <span>{currentClock}</span>
          </div>
        )}
      </div>

      {/* Language Quick Selector Pills */}
      <div className="flex items-center bg-slate-900/80 border border-white/[0.08] rounded-xl p-0.5 shadow-sm">
        <div className="px-2 py-1 text-slate-400 hidden md:flex items-center gap-1 text-[11px] font-medium">
          <Globe size={11} className="text-cyan-400" />
          <span>Lang:</span>
        </div>
        {(
          [
            { id: "auto", label: "Auto", desc: "Auto Detect" },
            { id: "en", label: "EN", desc: "English" },
            { id: "hi", label: "HI", desc: "हिन्दी" },
            { id: "te", label: "TE", desc: "తెలుగు" },
          ] as const
        ).map((l) => (
          <button
            key={l.id}
            onClick={() => onChangeLanguage(l.id)}
            title={l.desc}
            className={`px-2 sm:px-2.5 py-1 rounded-lg text-[10px] sm:text-xs font-semibold transition cursor-pointer active:scale-95 ${
              languageMode === l.id
                ? "bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 shadow-sm"
                : "text-slate-400 hover:text-white hover:bg-slate-800/60"
            }`}
          >
            {l.label}
          </button>
        ))}
      </div>

      {/* Action Controls */}
      <div className="flex items-center gap-1 sm:gap-2">
        {/* Productivity Tools Button */}
        <button
          onClick={onOpenTools}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium text-slate-300 hover:text-white bg-slate-900/70 hover:bg-slate-800/80 border border-white/[0.08] hover:border-cyan-500/30 transition cursor-pointer relative active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
          title="Productivity Tools (Tasks, Notes, Timers, Memory, Weather)"
        >
          <CheckSquare size={13} className="text-cyan-400" />
          <span className="hidden sm:inline">Tools</span>
          {totalProductivityCount > 0 && (
            <span className="min-w-4 h-4 px-1 rounded-full bg-cyan-400 text-slate-950 text-[9px] font-bold flex items-center justify-center shadow-sm">
              {totalProductivityCount}
            </span>
          )}
        </button>

        {/* Transcript Toggle */}
        <button
          onClick={onToggleTranscript}
          className={`flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
            isTranscriptOpen
              ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/40"
              : "text-slate-300 hover:text-white bg-slate-900/70 hover:bg-slate-800/80 border border-white/[0.08]"
          }`}
          title={isTranscriptOpen ? "Collapse Transcript" : "Expand Transcript"}
        >
          <MessageSquare size={13} />
          <span className="hidden sm:inline">Transcript</span>
          {isTranscriptOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>

        {/* Download Transcript */}
        <button
          onClick={onDownloadTranscript}
          className="p-1.5 rounded-xl text-slate-300 hover:text-white bg-slate-900/70 hover:bg-slate-800/80 border border-white/[0.08] hover:border-slate-700 transition cursor-pointer hidden md:flex active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
          title="Export Transcript"
        >
          <Download size={14} />
        </button>

        {/* Clear Chat */}
        <button
          onClick={onClearChat}
          className="p-1.5 rounded-xl text-slate-400 hover:text-rose-400 bg-slate-900/70 hover:bg-slate-800/80 border border-white/[0.08] hover:border-rose-500/30 transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
          title="Clear Conversation"
        >
          <Trash2 size={14} />
        </button>

        {/* Cloud Sync / Account Button */}
        <button
          onClick={onOpenAuth}
          className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-medium transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400 ${
            currentUser
              ? "bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800/50"
              : "bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/[0.08]"
          }`}
          title={currentUser ? `Cloud Synced (${currentUser.displayName || currentUser.email || "Guest"})` : "Sign In to Enable Cloud Sync"}
        >
          <Cloud size={13} className={isSyncing ? "text-cyan-400 animate-pulse" : currentUser ? "text-cyan-400" : "text-slate-400"} />
          <span className="hidden sm:inline">
            {isSyncing ? "Syncing..." : currentUser ? (currentUser.displayName || "Account") : "Sign In"}
          </span>
          {currentUser && (
            <span className={`w-1.5 h-1.5 rounded-full ${isSyncing ? "bg-cyan-400 animate-ping" : "bg-emerald-400"}`} />
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl text-xs font-medium text-slate-200 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-white/[0.08] hover:border-cyan-500/30 transition cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
          title="Voice, Language & Memory Settings"
        >
          <Sliders size={13} className="text-cyan-400" />
          <span className="hidden sm:inline">Settings</span>
        </button>
      </div>
    </header>
  );
};
