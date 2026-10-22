import React, { useRef, useEffect } from "react";
import { Message } from "../types";
import {
  Cloud,
  CloudRain,
  Sun,
  Volume2,
  Copy,
  Check,
  Clock,
  CheckCircle2,
  Bookmark,
  Timer as TimerIcon,
  Calculator,
  Brain,
  Globe,
  ExternalLink,
  Search,
  FileText,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";

interface ChatPanelProps {
  messages: Message[];
  isOpen: boolean;
  onReplaySpeech: (text: string) => void;
  onTaskToggle?: (title: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isOpen,
  onReplaySpeech,
}) => {
  const bottomRef = useRef<HTMLDivElement>(null);
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="w-full max-w-2xl mx-auto flex-1 overflow-y-auto px-4 py-2 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
      {messages.length === 0 ? (
        <div className="py-8 text-center text-slate-500 max-w-xs mx-auto">
          <p className="text-xs font-semibold text-slate-300">Conversation Transcript</p>
          <p className="text-[11px] mt-1 text-slate-400 leading-relaxed">
            Spoken responses, streamed answers, RAG knowledge citations, and safe actions will appear here.
          </p>
        </div>
      ) : (
        messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col max-w-[88%] sm:max-w-[80%] ${
              m.role === "user"
                ? "self-end ml-auto items-end"
                : "self-start mr-auto items-start"
            }`}
          >
            <div
              className={`px-4 py-2.5 rounded-2xl text-xs sm:text-sm leading-relaxed transition-all shadow-lg ${
                m.role === "user"
                  ? "bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-br-sm shadow-[0_4px_20px_rgba(2,132,199,0.25)]"
                  : "bg-slate-900/75 border border-white/[0.08] text-slate-100 rounded-bl-sm backdrop-blur-xl shadow-[0_4px_20px_rgba(0,0,0,0.35)]"
              }`}
            >
              {m.text}
              {m.isStreaming && (
                <span className="inline-block w-1.5 h-3.5 ml-1 bg-cyan-400 animate-pulse rounded-sm align-middle" />
              )}
            </div>

            {/* RAG Project Knowledge Sources */}
            {m.role === "assistant" && m.ragSources && m.ragSources.length > 0 && (
              <div className="w-full mt-2 p-2 rounded-xl bg-indigo-950/40 border border-indigo-500/20 text-xs backdrop-blur-xl">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-indigo-300 mb-1">
                  <FileText size={13} className="text-indigo-400" />
                  <span>Project Knowledge Sources (RAG)</span>
                </div>
                <div className="space-y-1">
                  {m.ragSources.map((rs, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-[11px] bg-slate-900/60 px-2 py-1 rounded border border-indigo-800/20"
                    >
                      <span className="text-slate-200 truncate font-medium">{rs.docTitle}</span>
                      <span className="text-[10px] font-mono text-indigo-300 ml-2 shrink-0">
                        match: {Math.round(rs.score * 100)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Search Grounding Citations */}
            {m.role === "assistant" && m.sources && m.sources.length > 0 && (
              <div className="w-full mt-2 p-2 rounded-xl bg-sky-950/40 border border-sky-500/20 text-xs backdrop-blur-xl">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-sky-300 mb-1">
                  <Search size={13} className="text-sky-400" />
                  <span>Web Sources & Citations</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {m.sources.map((src, idx) => (
                    <a
                      key={idx}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-900/70 border border-sky-800/30 text-[11px] text-sky-300 hover:text-sky-200 hover:border-sky-600 transition"
                    >
                      <span className="truncate max-w-[140px]">{src.title || src.domain || "Web Source"}</span>
                      <ExternalLink size={10} className="shrink-0" />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Tool Render Cards for Assistant Turns */}
            {m.role === "assistant" && m.toolAction && (
              <div className="w-full mt-2 space-y-1.5 animate-fade-in">
                {/* Safe Action Card (Web/Google/YouTube/Social) */}
                {m.toolAction.type === "safe_action" && (
                  <div
                    className={`p-3 rounded-2xl border text-xs shadow-md backdrop-blur-xl ${
                      m.toolAction.isAllowed !== false
                        ? "bg-slate-900/80 border-cyan-500/30"
                        : "bg-rose-950/60 border-rose-500/40"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {m.toolAction.isAllowed !== false ? (
                          <ShieldCheck size={16} className="text-cyan-400 shrink-0" />
                        ) : (
                          <AlertTriangle size={16} className="text-rose-400 shrink-0" />
                        )}
                        <div>
                          <div className="font-semibold text-white tracking-wide">
                            {m.toolAction.title}
                          </div>
                          <div className="text-[11px] text-slate-400">
                            {m.toolAction.description || m.toolAction.blockedReason}
                          </div>
                        </div>
                      </div>
                    </div>

                    {m.toolAction.isAllowed !== false && m.toolAction.destinationUrl && (
                      <div className="mt-2.5 pt-2 border-t border-white/[0.08] flex items-center justify-between">
                        <span className="text-[10px] font-mono text-cyan-300 truncate max-w-[180px]">
                          {m.toolAction.destinationUrl}
                        </span>
                        <a
                          href={m.toolAction.destinationUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-500 hover:to-sky-500 text-white font-medium text-[11px] flex items-center gap-1 shadow transition active:scale-95"
                        >
                          <span>{m.toolAction.buttonLabel || "Open Link ↗"}</span>
                          <ExternalLink size={11} />
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Weather Tool Card */}
                {m.toolAction.type === "weather" &&
                  m.toolAction.data &&
                  !m.toolAction.data.error && (
                    <div className="p-3 rounded-2xl bg-slate-900/70 border border-white/[0.08] shadow-md flex items-center justify-between text-xs backdrop-blur-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 rounded-xl bg-cyan-950/70 border border-cyan-800/50 text-cyan-400 shadow-sm">
                          {m.toolAction.data.condition.toLowerCase().includes("rain") ? (
                            <CloudRain size={18} />
                          ) : m.toolAction.data.condition.toLowerCase().includes("cloud") ? (
                            <Cloud size={18} />
                          ) : (
                            <Sun size={18} />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-white tracking-wide">
                            {m.toolAction.data.location}
                          </div>
                          <div className="text-[11px] text-slate-400 capitalize">
                            {m.toolAction.data.condition}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-bold text-white font-mono">
                          {m.toolAction.data.temperatureC}°C
                          <span className="text-[11px] text-slate-400 font-normal ml-1">
                            ({m.toolAction.data.temperatureF}°F)
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-400">
                          Wind {m.toolAction.data.windSpeedKmh} km/h
                        </div>
                      </div>
                    </div>
                  )}

                {/* Note Created Card */}
                {m.toolAction.type === "note" && (
                  <div className="p-2.5 rounded-2xl bg-slate-900/70 border border-white/[0.08] text-xs flex items-center gap-2.5 shadow-sm backdrop-blur-xl">
                    <Bookmark size={15} className="text-purple-400 shrink-0" />
                    <div className="flex-1 truncate">
                      <span className="text-slate-400 text-[10px] block font-medium">Saved Note</span>
                      <span className="text-white font-medium">
                        {m.toolAction.title || m.toolAction.content}
                      </span>
                    </div>
                  </div>
                )}

                {/* Task Created Card */}
                {m.toolAction.type === "task" && (
                  <div className="p-2.5 rounded-2xl bg-slate-900/70 border border-white/[0.08] text-xs flex items-center gap-2.5 shadow-sm backdrop-blur-xl">
                    <CheckCircle2 size={15} className="text-emerald-400 shrink-0" />
                    <div className="flex-1">
                      <span className="text-slate-400 text-[10px] block font-medium">Task Created</span>
                      <span className="text-white font-medium">{m.toolAction.title}</span>
                    </div>
                  </div>
                )}

                {/* Timer Card */}
                {m.toolAction.type === "timer" && (
                  <div className="p-2.5 rounded-2xl bg-slate-900/70 border border-white/[0.08] text-xs flex items-center gap-2.5 shadow-sm backdrop-blur-xl">
                    <TimerIcon size={15} className="text-amber-400 shrink-0" />
                    <div className="flex-1">
                      <span className="text-slate-400 text-[10px] block font-medium">Timer Set</span>
                      <span className="text-white font-medium">
                        {m.toolAction.label}: {m.toolAction.durationSeconds}s
                      </span>
                    </div>
                  </div>
                )}

                {/* Calculation Card */}
                {m.toolAction.type === "calculation" && (
                  <div className="p-2.5 rounded-2xl bg-slate-900/70 border border-emerald-500/30 text-xs flex items-center justify-between shadow-sm backdrop-blur-xl">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-emerald-950/80 text-emerald-400 border border-emerald-800/40">
                        <Calculator size={14} />
                      </div>
                      <div>
                        <span className="text-slate-400 text-[10px] block font-medium">Math Calculation</span>
                        <span className="text-white font-mono font-medium">{m.toolAction.expression}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-mono font-bold text-emerald-300">= {m.toolAction.result}</span>
                    </div>
                  </div>
                )}

                {/* Long-Term Memory Card */}
                {m.toolAction.type === "memory" && (
                  <div className="p-2.5 rounded-2xl bg-slate-900/70 border border-purple-500/30 text-xs flex items-center gap-2.5 shadow-sm backdrop-blur-xl">
                    <div className="p-1.5 rounded-lg bg-purple-950/80 text-purple-400 border border-purple-800/40">
                      <Brain size={14} />
                    </div>
                    <div className="flex-1 truncate">
                      <span className="text-purple-300 text-[10px] block font-medium">Saved to Memory</span>
                      <span className="text-white font-medium">
                        {m.toolAction.key ? `${m.toolAction.key}: ${m.toolAction.value}` : m.toolAction.value}
                      </span>
                    </div>
                  </div>
                )}

                {/* Language Switched Card */}
                {m.toolAction.type === "language" && (
                  <div className="p-2 rounded-2xl bg-slate-900/70 border border-sky-500/30 text-xs flex items-center gap-2 shadow-sm backdrop-blur-xl">
                    <Globe size={14} className="text-sky-400" />
                    <span className="text-slate-300 text-[11px]">Language Mode set to:</span>
                    <span className="text-cyan-300 font-semibold uppercase">{m.toolAction.newLanguage}</span>
                  </div>
                )}

                {/* Time Query Card */}
                {m.toolAction.type === "time" && m.toolAction.data && (
                  <div className="p-2.5 rounded-2xl bg-slate-900/80 border border-sky-500/20 text-xs flex items-center justify-between gap-3 shadow-md backdrop-blur-xl">
                    <div className="flex items-center gap-2">
                      <Clock size={15} className="text-sky-400 shrink-0" />
                      <div>
                        <span className="text-white font-mono font-medium">
                          {m.toolAction.data.timeShort || m.toolAction.data.time}
                        </span>
                        <span className="text-slate-400 text-[11px] ml-1.5">· {m.toolAction.data.date}</span>
                      </div>
                    </div>
                    {m.toolAction.data.timezone && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-sky-300 bg-sky-950/70 border border-sky-800/40 shrink-0">
                        {m.toolAction.data.timezone}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Assistant Turn Metadata & Replay Controls */}
            {m.role === "assistant" && (
              <div className="flex items-center gap-2 mt-1 px-1 text-[11px] text-slate-500">
                <span className="font-mono text-[10px] text-slate-500">{m.timestamp}</span>
                <button
                  onClick={() => onReplaySpeech(m.text)}
                  className="p-1 rounded hover:text-cyan-400 transition cursor-pointer active:scale-90"
                  title="Replay Voice"
                >
                  <Volume2 size={12} />
                </button>
                <button
                  onClick={() => handleCopy(m.id, m.text)}
                  className="p-1 rounded hover:text-cyan-400 transition cursor-pointer active:scale-90"
                  title="Copy Text"
                >
                  {copiedId === m.id ? (
                    <Check size={12} className="text-emerald-400" />
                  ) : (
                    <Copy size={12} />
                  )}
                </button>
              </div>
            )}
          </div>
        ))
      )}
      <div ref={bottomRef} />
    </div>
  );
};
