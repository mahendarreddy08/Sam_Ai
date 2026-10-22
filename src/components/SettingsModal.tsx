import React, { useState, useRef } from "react";
import { VoiceSettings, DiagnosticsData, LanguageMode, VoiceGender } from "../types";
import {
  X,
  Sliders,
  Volume2,
  Shield,
  Eye,
  Activity,
  Trash2,
  Check,
  ExternalLink,
  Globe,
  Brain,
  Sparkles,
  Play,
  Square,
  Loader2,
  User,
  Radio,
  MapPin,
} from "lucide-react";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: VoiceSettings;
  onUpdateSettings: (newSettings: Partial<VoiceSettings>) => void;
  onTestVoice: () => void;
  onClearAllData: () => void;
  onOpenDiagnostics: () => void;
  diagnostics?: DiagnosticsData;
  savedMemoriesCount?: number;
  onClearMemory?: () => void;
  onInterrupt?: () => void;
}

interface CatalogVoice {
  name: VoiceSettings["voiceName"];
  gender: VoiceGender;
  label: string;
  desc: string;
  roleBadge: string;
}

const PREBUILT_VOICES: CatalogVoice[] = [
  {
    name: "Aoede",
    gender: "female",
    label: "Aoede",
    desc: "Breezy, melodic, natural & expressive female register",
    roleBadge: "Female · Melodic",
  },
  {
    name: "Kore",
    gender: "female",
    label: "Kore",
    desc: "Warm, soothing, clear & empathetic female tone",
    roleBadge: "Female · Soothing",
  },
  {
    name: "Puck",
    gender: "male",
    label: "Puck",
    desc: "Energetic, dynamic, bright & playful masculine tone",
    roleBadge: "Male · Energetic",
  },
  {
    name: "Fenrir",
    gender: "male",
    label: "Fenrir",
    desc: "Authoritative, confident, deep & strong masculine tone",
    roleBadge: "Male · Authoritative",
  },
  {
    name: "Charon",
    gender: "male",
    label: "Charon",
    desc: "Low-pitched, thoughtful, informative & resonant tone",
    roleBadge: "Male · Thoughtful",
  },
  {
    name: "Zephyr",
    gender: "neutral",
    label: "Zephyr",
    desc: "Balanced, crisp, modern, clear & versatile neutral tone",
    roleBadge: "Neutral · Balanced",
  },
];

const LANGUAGE_OPTIONS: Array<{ id: LanguageMode; title: string; subtitle: string }> = [
  { id: "auto", title: "Auto-Detect", subtitle: "Seamlessly switches between English, Telugu, & Hindi based on what you speak" },
  { id: "en", title: "English", subtitle: "Natural English, including Indian English idioms & technical vocabulary" },
  { id: "hi", title: "Hindi (हिन्दी)", subtitle: "Natural conversational Hindi with Devanagari script responses" },
  { id: "te", title: "Telugu (తెలుగు)", subtitle: "Everyday colloquial Telugu with Telugu script responses & code-switching" },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  onTestVoice,
  onClearAllData,
  onOpenDiagnostics,
  diagnostics,
  savedMemoriesCount = 0,
  onClearMemory,
  onInterrupt,
}) => {
  const [genderFilter, setGenderFilter] = useState<"all" | "female" | "male" | "neutral">("all");
  const [previewLoading, setPreviewLoading] = useState<string | null>(null);
  const [activePlayingVoice, setActivePlayingVoice] = useState<string | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);

  if (!isOpen) return null;

  const stopCurrentAudio = () => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.src = "";
      activeAudioRef.current = null;
    }
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (onInterrupt) {
      onInterrupt();
    }
    setActivePlayingVoice(null);
    setPreviewLoading(null);
  };

  const handlePreviewVoice = async (voiceName: VoiceSettings["voiceName"]) => {
    // If currently playing this voice, stop it
    if (activePlayingVoice === voiceName) {
      stopCurrentAudio();
      return;
    }

    // Stop any ongoing playback across the entire app
    stopCurrentAudio();
    if (onInterrupt) {
      onInterrupt();
    }
    setPreviewLoading(voiceName);

    try {
      const res = await fetch("/api/voice/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: voiceName, language: settings.languageMode }),
      });

      const data = await res.json();
      setPreviewLoading(null);

      if (data.audio) {
        const audio = new Audio(`data:audio/wav;base64,${data.audio}`);
        audio.playbackRate = settings.speechRate;
        activeAudioRef.current = audio;
        setActivePlayingVoice(voiceName);

        audio.onended = () => {
          setActivePlayingVoice(null);
          activeAudioRef.current = null;
        };
        audio.onerror = () => {
          setActivePlayingVoice(null);
          activeAudioRef.current = null;
        };

        await audio.play();
      } else {
        // Fallback speech synthesis sample
        if (typeof window !== "undefined" && window.speechSynthesis) {
          const sample = data.sampleText || `Hello! I am S.A.M. speaking with the ${voiceName} persona.`;
          const utterance = new SpeechSynthesisUtterance(sample);
          utterance.rate = settings.speechRate;
          setActivePlayingVoice(voiceName);
          utterance.onend = () => setActivePlayingVoice(null);
          utterance.onerror = () => setActivePlayingVoice(null);
          window.speechSynthesis.speak(utterance);
        }
      }
    } catch (err) {
      console.warn("Preview audio playback failed:", err);
      setPreviewLoading(null);
      setActivePlayingVoice(null);
    }
  };

  const filteredVoices = PREBUILT_VOICES.filter((v) => {
    if (genderFilter === "all") return true;
    return v.gender === genderFilter;
  });

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800 font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders size={18} className="text-cyan-400" />
            <h3 className="text-base font-bold text-white">S.A.M. System Settings</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Developer Diagnostics Quick Access Banner */}
        <div className="p-3 bg-gradient-to-r from-slate-900/90 to-cyan-950/40 rounded-xl border border-cyan-800/40 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
              <Activity size={14} className="text-cyan-400 animate-pulse" />
              <span>Developer Diagnostics</span>
            </div>
            <p className="text-[10px] text-slate-400">
              Real mic streams, 16k PCM buffers, WebSocket status, & model events.
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenDiagnostics}
            className="px-3 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-700/60 text-xs font-semibold text-cyan-200 hover:text-white transition cursor-pointer shadow-sm flex items-center gap-1"
          >
            <span>Open Panel</span>
            <ExternalLink size={11} />
          </button>
        </div>

        {/* 1. Multilingual Language Selector */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Globe size={13} className="text-cyan-400" />
            Active Language System
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {LANGUAGE_OPTIONS.map((lang) => (
              <button
                key={lang.id}
                type="button"
                onClick={() => onUpdateSettings({ languageMode: lang.id })}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  settings.languageMode === lang.id
                    ? "bg-cyan-950/70 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/30"
                    : "bg-slate-900/50 border-slate-800/80 hover:bg-slate-900"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{lang.title}</span>
                  {settings.languageMode === lang.id && <Check size={14} className="text-cyan-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1 leading-snug">{lang.subtitle}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 2. Conversational Response Style */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Sparkles size={13} className="text-sky-400" />
            Assistant Response Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "concise", label: "Concise", desc: "1-2 spoken sentences" },
                { id: "balanced", label: "Balanced", desc: "Natural dialogue & empathy" },
                { id: "detailed", label: "Detailed", desc: "In-depth code & math" },
              ] as const
            ).map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onUpdateSettings({ responseStyle: s.id })}
                className={`p-2 rounded-xl border text-left transition cursor-pointer ${
                  settings.responseStyle === s.id
                    ? "bg-sky-950/70 border-sky-500/80 shadow-md"
                    : "bg-slate-900/50 border-slate-800/80 hover:bg-slate-900"
                }`}
              >
                <div className="text-xs font-bold text-white">{s.label}</div>
                <p className="text-[9px] text-slate-400 mt-0.5">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Persistent Memory Control */}
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-purple-300">
              <Brain size={14} className="text-purple-400" />
              <span>Personal Memory Retention</span>
            </div>
            <span className="text-[10px] font-mono text-purple-300 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-800/40">
              {savedMemoriesCount} facts saved
            </span>
          </div>

          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.enableMemory}
              onChange={(e) => onUpdateSettings({ enableMemory: e.target.checked })}
              className="mt-0.5 rounded border-slate-700 bg-slate-800 text-purple-500 focus:ring-0"
            />
            <div>
              <span className="text-xs font-medium text-slate-200 block">
                Retain Personal Context Across Conversations
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5 leading-relaxed">
                Allows S.A.M. to remember your preferred language, active coding projects, personal goals, and name without restarting from scratch each session.
              </span>
            </div>
          </label>

          {savedMemoriesCount > 0 && onClearMemory && (
            <div className="pt-2 flex justify-end border-t border-slate-800">
              <button
                type="button"
                onClick={onClearMemory}
                className="px-2.5 py-1 rounded bg-purple-950/60 hover:bg-purple-900 border border-purple-800/40 text-[11px] text-purple-300 hover:text-white transition cursor-pointer"
              >
                Reset Saved Memory
              </button>
            </div>
          )}
        </div>

        {/* 4. User-Configurable Clock & Display Location */}
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
              <MapPin size={13} className="text-emerald-400" />
              <span>Default Clock & Display Location</span>
            </div>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/40">
              IST (Asia/Kolkata)
            </span>
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            Default geographic location reported when asking for the current date or time. Technical calculations accurately use India Standard Time (Asia/Kolkata).
          </p>
          <div className="flex items-center gap-2 pt-1">
            <input
              type="text"
              value={settings.userLocation || "Hyderabad, Telangana, India"}
              onChange={(e) => onUpdateSettings({ userLocation: e.target.value })}
              placeholder="Hyderabad, Telangana, India"
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
            <button
              type="button"
              onClick={() => onUpdateSettings({ userLocation: "Hyderabad, Telangana, India" })}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 hover:text-white transition cursor-pointer"
            >
              Reset Default
            </button>
          </div>
        </div>

        {/* 4. Voice Persona Selector with Audio Preview (Priority 1) */}
        <div className="space-y-3 p-3.5 bg-slate-900/60 rounded-xl border border-slate-800">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Volume2 size={13} className="text-cyan-400" />
              <span>Gemini Voice Persona & Synthesis</span>
            </label>
            <span className="text-[10px] text-cyan-300 font-medium px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-800/50">
              Active: {settings.voiceName}
            </span>
          </div>

          {/* Gender / Tone Filter Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-950 rounded-lg border border-slate-800/80">
            {(
              [
                { id: "all", label: "All Voices" },
                { id: "female", label: "Female" },
                { id: "male", label: "Male" },
                { id: "neutral", label: "Neutral" },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setGenderFilter(tab.id)}
                className={`flex-1 py-1 rounded text-[11px] font-medium transition cursor-pointer ${
                  genderFilter === tab.id
                    ? "bg-slate-800 text-white shadow-sm font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Voice Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {filteredVoices.map((v) => {
              const isSelected = settings.voiceName === v.name;
              const isPlaying = activePlayingVoice === v.name;
              const isLoading = previewLoading === v.name;

              return (
                <div
                  key={v.name}
                  onClick={() => onUpdateSettings({ voiceName: v.name })}
                  className={`p-3 rounded-xl border transition cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? "bg-cyan-950/70 border-cyan-500/80 shadow-md ring-1 ring-cyan-500/40"
                      : "bg-slate-950/70 border-slate-800 hover:border-slate-700 hover:bg-slate-900/60"
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-white tracking-wide">{v.name}</span>
                        <span
                          className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${
                            v.gender === "female"
                              ? "bg-emerald-950/70 border-emerald-800/60 text-emerald-300"
                              : v.gender === "male"
                              ? "bg-sky-950/70 border-sky-800/60 text-sky-300"
                              : "bg-purple-950/70 border-purple-800/60 text-purple-300"
                          }`}
                        >
                          {v.roleBadge}
                        </span>
                      </div>
                      {isSelected && <Check size={14} className="text-cyan-400 shrink-0" />}
                    </div>

                    <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">{v.desc}</p>
                  </div>

                  {/* Preview Button */}
                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between">
                    <span className="text-[9px] text-slate-500">
                      {isSelected ? "Current Persona" : "Click card to select"}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewVoice(v.name);
                      }}
                      disabled={isLoading}
                      className={`px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 transition cursor-pointer active:scale-95 ${
                        isPlaying
                          ? "bg-rose-950 text-rose-300 border border-rose-700/60 animate-pulse"
                          : isLoading
                          ? "bg-slate-800 text-slate-400 border border-slate-700"
                          : "bg-slate-900 hover:bg-cyan-950 text-slate-300 hover:text-cyan-300 border border-slate-800 hover:border-cyan-800/60"
                      }`}
                      title={`Preview ${v.name} voice sample`}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 size={11} className="animate-spin text-cyan-400" />
                          <span>Generating...</span>
                        </>
                      ) : isPlaying ? (
                        <>
                          <Square size={10} className="fill-rose-400 text-rose-400" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Play size={10} className="fill-current" />
                          <span>Sample</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 5. Text-To-Speech Rate Slider */}
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-200">Text-to-Speech Spoken Rate</span>
            <span className="text-xs font-mono font-semibold text-cyan-400">
              {settings.speechRate.toFixed(1)}x{" "}
              {settings.speechRate === 1.0 ? "(Normal)" : settings.speechRate < 1.0 ? "(Slower)" : "(Faster)"}
            </span>
          </div>

          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={settings.speechRate}
            onChange={(e) => onUpdateSettings({ speechRate: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
          />

          <div className="flex justify-between items-center text-[10px] text-slate-500">
            <span>0.5x</span>
            <div className="flex items-center gap-1.5">
              {[0.8, 1.0, 1.2, 1.5].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onUpdateSettings({ speechRate: preset })}
                  className={`px-1.5 py-0.5 rounded cursor-pointer transition ${
                    Math.abs(settings.speechRate - preset) < 0.05
                      ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold"
                      : "hover:text-slate-300"
                  }`}
                >
                  {preset}x
                </button>
              ))}
            </div>
            <span>2.0x</span>
          </div>

          <div className="pt-1.5 flex items-center justify-between border-t border-slate-800/80">
            <span className="text-[10px] text-slate-400">Preview spoken speed:</span>
            <button
              type="button"
              onClick={onTestVoice}
              className="px-3 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-800/60 text-xs font-medium text-cyan-300 hover:text-white transition flex items-center gap-1 cursor-pointer"
            >
              <Volume2 size={12} />
              <span>Test Voice Rate</span>
            </button>
          </div>
        </div>

        {/* 6. 3D Graphics Quality Mode */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
            <Eye size={13} className="text-purple-400" />
            3D Visualizer Fidelity
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(
              [
                { id: "ultra", label: "Ultra 3D", desc: "Full GLSL shaders & 180 particles" },
                { id: "balanced", label: "Balanced", desc: "Optimized 36-segment sphere" },
                { id: "minimal", label: "Minimal", desc: "Lightweight 2D canvas fallback" },
              ] as const
            ).map((q) => (
              <button
                key={q.id}
                type="button"
                onClick={() => onUpdateSettings({ graphicsQuality: q.id })}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer ${
                  settings.graphicsQuality === q.id
                    ? "bg-purple-950/70 border-purple-500/80 shadow-md"
                    : "bg-slate-900/50 border-slate-800/80 hover:bg-slate-900"
                }`}
              >
                <div className="text-xs font-bold text-white">{q.label}</div>
                <p className="text-[9px] text-slate-400 mt-0.5 leading-snug">{q.desc}</p>
              </button>
            ))}
          </div>
        </div>

        {/* 7. Hands-Free Wake Word Mode ("Hey Sam") */}
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.handsFreeStandby}
              onChange={(e) => onUpdateSettings({ handsFreeStandby: e.target.checked })}
              className="mt-0.5 rounded border-slate-700 bg-slate-800 text-cyan-500 focus:ring-0"
            />
            <div>
              <span className="text-xs font-medium text-slate-200 block">
                Strict Wake Word Filtering ("Hey Sam")
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                When enabled in voice mode, S.A.M. filters ambient conversation and only awakens when you address it by name ("Hey Sam", "Hello Sam", or "నమస్కారం శామ్").
              </span>
            </div>
          </label>
        </div>

        {/* 8. Privacy & Storage */}
        <div className="p-3.5 bg-slate-900/80 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-200">
            <Shield size={13} className="text-emerald-400" />
            Privacy & Client Storage
          </div>
          <p className="text-[11px] text-slate-400 leading-relaxed">
            All notes, tasks, timers, memory items, and voice preferences are persisted in your local browser storage. Raw audio is processed ephemerally for real-time speech and is never written to disk.
          </p>
          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={onClearAllData}
              className="px-3 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900 border border-rose-800/50 text-xs text-rose-300 hover:text-white transition cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 size={13} />
              <span>Clear All Local History</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 font-bold text-xs hover:brightness-110 transition cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
