import React, { useState } from "react";
import { Mic, Send, VolumeX, Sparkles, CornerDownLeft } from "lucide-react";
import { AssistantState } from "../types";

interface ControlsDockProps {
  state: AssistantState;
  isListening: boolean;
  liveSubtitle: string;
  onToggleVoice: () => void;
  onInterrupt: () => void;
  onSendMessage: (text: string) => void;
  onSelectSuggestion: (text: string) => void;
}

const SUGGESTIONS = [
  "What time is it?",
  "What time is it in Kolkata?",
  "Naku Python lo functions explain cheyyi",
  "You did an awesome job, congratulations!",
  "సమయం ఎంత?",
  "समय क्या है?",
  "Calculate 25 * 18 + 140",
  "Weather in Hyderabad",
  "Explain quantum computing simply",
  "Set a 5 minute coding timer",
  "Add task: Practice voice conversation in Telugu",
];

export const ControlsDock: React.FC<ControlsDockProps> = ({
  state,
  isListening,
  liveSubtitle,
  onToggleVoice,
  onInterrupt,
  onSendMessage,
  onSelectSuggestion,
}) => {
  const [inputText, setInputText] = useState("");

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;
    onSendMessage(inputText.trim());
    setInputText("");
  };

  const getMicButtonClasses = () => {
    switch (state) {
      case "listening":
        return "bg-emerald-500 text-slate-950 shadow-[0_0_30px_rgba(16,185,129,0.7)] scale-105 ring-2 ring-emerald-300 animate-pulse";
      case "speaking":
        return "bg-gradient-to-r from-amber-400 to-pink-500 text-slate-950 shadow-[0_0_30px_rgba(245,158,11,0.7)] scale-105 ring-2 ring-amber-300";
      case "thinking":
        return "bg-gradient-to-r from-purple-600 to-violet-500 text-white shadow-[0_0_24px_rgba(168,85,247,0.6)] animate-pulse";
      case "connecting":
        return "bg-sky-500 text-slate-950 shadow-[0_0_20px_rgba(14,165,233,0.6)] animate-bounce";
      case "error":
        return "bg-rose-600 text-white shadow-[0_0_20px_rgba(225,29,72,0.6)]";
      default:
        return "bg-slate-900/90 text-cyan-400 hover:text-white hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.15)]";
    }
  };

  return (
    <div className="w-full max-w-xl mx-auto px-4 pb-4 sm:pb-6 space-y-3 z-20">
      {/* Live Transcript / Subtitle Floating Banner */}
      {liveSubtitle && (
        <div className="text-center px-4 py-2 rounded-full bg-slate-900/90 border border-cyan-500/40 shadow-[0_4px_24px_rgba(6,182,212,0.25)] max-w-md mx-auto backdrop-blur-xl animate-fade-in transition-all">
          <p className="text-xs sm:text-sm text-cyan-200 italic font-medium truncate tracking-wide">
            "{liveSubtitle}"
          </p>
        </div>
      )}

      {/* Suggested Prompts Horizon with Smooth Scrolling */}
      <div className="flex gap-2 overflow-x-auto py-1 scrollbar-none justify-start sm:justify-center mask-fade-edges">
        {SUGGESTIONS.map((chip, i) => (
          <button
            key={i}
            onClick={() => onSelectSuggestion(chip)}
            className="text-[11px] whitespace-nowrap px-3.5 py-1.5 rounded-full bg-slate-900/60 hover:bg-slate-800/80 border border-white/[0.08] hover:border-cyan-500/40 text-slate-300 hover:text-white transition-all shrink-0 cursor-pointer shadow-sm active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Unified Input Composer Dock */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950/85 border border-white/[0.1] shadow-2xl backdrop-blur-2xl transition-all focus-within:border-cyan-500/50 focus-within:ring-2 focus-within:ring-cyan-500/20"
      >
        {/* Voice Trigger Mic Button with Tactile Feedback */}
        <button
          type="button"
          onClick={state === "speaking" ? onInterrupt : onToggleVoice}
          className={`w-11 h-11 rounded-xl transition-all duration-300 cursor-pointer flex items-center justify-center shrink-0 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${getMicButtonClasses()}`}
          title={
            state === "speaking"
              ? "Interrupt S.A.M. (or say anything)"
              : isListening
              ? "Stop Voice Session"
              : "Start Hands-Free Voice Session"
          }
          aria-label="Voice input toggle"
        >
          {state === "speaking" ? (
            <VolumeX size={19} />
          ) : (
            <Mic size={19} className={state === "listening" ? "scale-110" : ""} />
          )}
        </button>

        {/* Text Input */}
        <input
          type="text"
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder={
            state === "listening"
              ? "Listening... Speak naturally or type here"
              : state === "speaking"
              ? "Speaking... (click mic or tap to interrupt)"
              : "Ask S.A.M. anything or say 'Hey Sam'..."
          }
          className="flex-1 bg-transparent px-3 py-2 text-xs sm:text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
        />

        {/* Interrupt button if speaking */}
        {state === "speaking" && (
          <button
            type="button"
            onClick={onInterrupt}
            className="px-2.5 py-1.5 rounded-lg bg-rose-500/20 text-rose-300 border border-rose-500/30 hover:bg-rose-500/30 text-xs font-medium transition cursor-pointer shrink-0 active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-400"
          >
            Interrupt
          </button>
        )}

        {/* Send Button */}
        <button
          type="submit"
          disabled={!inputText.trim()}
          className={`w-9 h-9 rounded-xl transition cursor-pointer shrink-0 flex items-center justify-center active:scale-95 ${
            inputText.trim()
              ? "bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 font-bold hover:brightness-110 shadow-[0_0_12px_rgba(6,182,212,0.4)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-400"
              : "bg-slate-900/60 text-slate-600 cursor-not-allowed"
          }`}
          title="Send prompt"
          aria-label="Send message"
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};
