import React from "react";
import { DiagnosticsData } from "../types";
import { Activity, Mic, Radio, Volume2, AlertCircle, RefreshCw, X, Play, RotateCcw, CheckCircle2, XCircle } from "lucide-react";

interface DiagnosticsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  diagnostics: DiagnosticsData;
  onTestMic: () => void;
  onReconnect: () => void;
  onResumeAudio: () => void;
  onResetCounters: () => void;
}

export const DiagnosticsPanel: React.FC<DiagnosticsPanelProps> = ({
  isOpen,
  onClose,
  diagnostics,
  onTestMic,
  onReconnect,
  onResumeAudio,
  onResetCounters,
}) => {
  if (!isOpen) return null;

  const getPermColor = (perm: DiagnosticsData["micPermission"]) => {
    switch (perm) {
      case "granted":
        return "text-emerald-400 bg-emerald-950/70 border-emerald-800/80";
      case "denied":
        return "text-rose-400 bg-rose-950/70 border-rose-800/80";
      case "prompt":
        return "text-amber-400 bg-amber-950/70 border-amber-800/80";
      default:
        return "text-slate-400 bg-slate-900 border-slate-800";
    }
  };

  const getWsColor = (ws: DiagnosticsData["wsState"]) => {
    switch (ws) {
      case "connected":
        return "text-emerald-400 bg-emerald-950/70 border-emerald-800/80";
      case "connecting":
        return "text-amber-400 bg-amber-950/70 border-amber-800/80";
      case "error":
        return "text-rose-400 bg-rose-950/70 border-rose-800/80";
      default:
        return "text-slate-400 bg-slate-900 border-slate-800";
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-slate-950 border border-slate-800 rounded-2xl max-w-xl w-full p-5 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto font-sans">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Activity size={18} className="text-cyan-400 animate-pulse" />
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                Live Voice Engine Diagnostics
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-semibold uppercase">
                  Real Telemetry
                </span>
              </h3>
              <p className="text-[10px] text-slate-400">
                Direct Web Audio, WebSocket, and Hardware Pipeline Metrics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* 1. Microphone & Hardware Pipeline */}
        <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/90 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Mic size={14} className="text-cyan-400" />
              1. Microphone & Capture Pipeline
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border capitalize font-semibold ${getPermColor(
                diagnostics.micPermission
              )}`}
            >
              Permission: {diagnostics.micPermission}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Stream Capture</span>
              <span
                className={`font-semibold flex items-center gap-1 mt-0.5 ${
                  diagnostics.micCaptureActive ? "text-emerald-400" : "text-slate-400"
                }`}
              >
                {diagnostics.micCaptureActive ? (
                  <>
                    <CheckCircle2 size={12} /> Active & Streaming
                  </>
                ) : (
                  <>
                    <XCircle size={12} /> Inactive
                  </>
                )}
              </span>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Input AudioContext</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">
                {diagnostics.inputAudioCtxState} ({diagnostics.micSampleRate ? `${diagnostics.micSampleRate}Hz` : "0Hz"})
              </span>
            </div>
          </div>

          {/* Real-time live input RMS meter */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[10px] text-slate-400 font-mono">
              <span>Mic Real-time RMS:</span>
              <span>{(diagnostics.outgoingRms * 100).toFixed(1)}%</span>
            </div>
            <div className="w-full h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-emerald-500 via-cyan-400 to-amber-400 transition-all duration-75"
                style={{ width: `${Math.min(100, diagnostics.outgoingRms * 250)}%` }}
              />
            </div>
          </div>
        </div>

        {/* 2. Live API Session & Bridge */}
        <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/90 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Radio size={14} className="text-purple-400" />
              2. WebSocket & Gemini Live Session
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border uppercase font-semibold ${getWsColor(
                diagnostics.wsState
              )}`}
            >
              WS: {diagnostics.wsState}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono pt-1">
            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Gemini Live Engine</span>
              <span
                className={`font-semibold mt-0.5 block ${
                  diagnostics.liveSupported ? "text-cyan-300" : "text-amber-400"
                }`}
              >
                {diagnostics.liveSupported ? "gemini-3.8-live Native" : "Local Speech Fallback"}
              </span>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Last Model Event</span>
              <span className="text-slate-200 font-semibold mt-0.5 block truncate">
                {diagnostics.lastModelEvent || "None"}
              </span>
            </div>
          </div>
        </div>

        {/* 3. Outgoing vs Incoming Audio Telemetry */}
        <div className="grid grid-cols-2 gap-2.5">
          {/* Outgoing */}
          <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/90 space-y-1.5 font-mono">
            <span className="text-[11px] font-bold text-slate-200 block">Outgoing Stream</span>
            <div className="text-[10px] space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>Packets:</span>
                <span className="text-white font-semibold">{diagnostics.outgoingPackets}</span>
              </div>
              <div className="flex justify-between">
                <span>Bytes:</span>
                <span className="text-cyan-300 font-semibold">
                  {(diagnostics.outgoingBytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Sent:</span>
                <span className="text-slate-300">{diagnostics.lastOutgoingTime || "—"}</span>
              </div>
            </div>
          </div>

          {/* Incoming */}
          <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/90 space-y-1.5 font-mono">
            <span className="text-[11px] font-bold text-slate-200 block">Incoming Audio</span>
            <div className="text-[10px] space-y-1 text-slate-400">
              <div className="flex justify-between">
                <span>Chunks:</span>
                <span className="text-white font-semibold">{diagnostics.incomingChunks}</span>
              </div>
              <div className="flex justify-between">
                <span>Bytes:</span>
                <span className="text-purple-300 font-semibold">
                  {(diagnostics.incomingBytes / 1024).toFixed(1)} KB
                </span>
              </div>
              <div className="flex justify-between">
                <span>Last Recv:</span>
                <span className="text-slate-300">{diagnostics.lastIncomingTime || "—"}</span>
              </div>
            </div>
          </div>
        </div>

        {/* 4. Playback State & Output AudioContext */}
        <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/90 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
              <Volume2 size={14} className="text-amber-400" />
              4. Playback Engine
            </span>
            <span
              className={`text-[10px] font-mono px-2 py-0.5 rounded-full border capitalize font-semibold ${
                diagnostics.playbackState === "playing"
                  ? "text-amber-400 bg-amber-950/70 border-amber-800/80 animate-pulse"
                  : "text-slate-400 bg-slate-900 border-slate-800"
              }`}
            >
              Playback: {diagnostics.playbackState}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Active Speech Engine</span>
              <span className="text-cyan-300 font-semibold mt-0.5 block flex items-center gap-1.5">
                <span className={`w-2 h-2 rounded-full ${diagnostics.activeAudioProvider !== "none" ? "bg-emerald-400 animate-pulse" : "bg-slate-500"}`} />
                {diagnostics.activeAudioProvider === "gemini_live"
                  ? "Gemini Live (24kHz Native)"
                  : diagnostics.activeAudioProvider === "gemini_tts"
                  ? "Neural Gemini TTS"
                  : diagnostics.activeAudioProvider === "browser_tts"
                  ? "Browser Speech Synthesis"
                  : "None (Idle)"}
              </span>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Response ID & Stop Reason</span>
              <span className="text-slate-200 font-semibold mt-0.5 block truncate">
                Turn #{diagnostics.activeResponseId || 0} {diagnostics.lastAudioStopReason ? `(${diagnostics.lastAudioStopReason})` : ""}
              </span>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Output AudioContext</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">
                {diagnostics.outputAudioCtxState} (24000Hz)
              </span>
            </div>

            <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800/60">
              <span className="text-slate-400 block text-[10px]">Active Sound Sources</span>
              <span className="text-slate-200 font-semibold mt-0.5 block">
                {diagnostics.activeSourcesCount} buffer nodes
              </span>
            </div>
          </div>
        </div>

        {/* 5. Most Recent Error */}
        <div className="p-3 bg-slate-900/70 rounded-xl border border-slate-800/90 space-y-1">
          <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <AlertCircle size={13} className={diagnostics.lastError ? "text-rose-400" : "text-emerald-400"} />
            5. Most Recent Pipeline Status
          </span>
          <p
            className={`text-[11px] font-mono p-2 rounded-lg border ${
              diagnostics.lastError
                ? "bg-rose-950/40 border-rose-900/60 text-rose-300"
                : "bg-slate-950/60 border-slate-800/60 text-slate-400"
            }`}
          >
            {diagnostics.lastError || "None (All pipeline stages nominal)"}
          </p>
        </div>

        {/* Interactive Action Controls */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTestMic}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white transition cursor-pointer flex items-center gap-1"
            >
              <Mic size={12} className="text-cyan-400" />
              <span>Check Mic Perm</span>
            </button>

            <button
              type="button"
              onClick={onResumeAudio}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white transition cursor-pointer flex items-center gap-1"
            >
              <Play size={12} className="text-amber-400" />
              <span>Resume Audio</span>
            </button>

            <button
              type="button"
              onClick={onReconnect}
              className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-200 hover:text-white transition cursor-pointer flex items-center gap-1"
            >
              <RefreshCw size={12} className="text-purple-400" />
              <span>Reconnect WS</span>
            </button>

            <button
              type="button"
              onClick={onResetCounters}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-900 transition cursor-pointer"
              title="Reset Packet Counters"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-sky-600 text-slate-950 font-bold text-xs hover:brightness-110 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
