import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  AssistantState,
  Message,
  Task,
  Note,
  ActiveTimer,
  WeatherInfo,
  VoiceSettings,
  DiagnosticsData,
  UserMemoryItem,
  LanguageMode,
  DailyBriefing,
} from "./types";
import { ThreeOrb } from "./components/ThreeOrb";
import { Header } from "./components/Header";
import { ChatPanel } from "./components/ChatPanel";
import { ControlsDock } from "./components/ControlsDock";
import { QuickActions } from "./components/QuickActions";
import { ToolsDrawer } from "./components/ToolsDrawer";
import { SettingsModal } from "./components/SettingsModal";
import { DiagnosticsPanel } from "./components/DiagnosticsPanel";
import { AuthModal } from "./components/AuthModal";
import { VoiceController } from "./components/VoiceController";
import { launchWebsite } from "./services/websiteLauncher";
import { SentimentTheme, THEME_PALETTES, analyzeSentiment } from "./utils/themeEngine";
import {
  auth,
  saveUserTask,
  deleteUserTask,
  saveUserNote,
  deleteUserNote,
  saveUserMemory,
  deleteUserMemory,
  clearAllUserMemories,
  subscribeUserTasks,
  subscribeUserNotes,
  subscribeUserMemories,
  migrateLocalStorageToCloud,
  exportUserDataAsJSON,
  saveUserSettings,
  loadUserSettings,
} from "./services/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { Sparkles, ShieldAlert } from "lucide-react";

export default function App() {
  // Assistant States
  const [assistantState, setAssistantState] = useState<AssistantState>("idle");
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [isListening, setIsListening] = useState<boolean>(false);
  const [liveSubtitle, setLiveSubtitle] = useState<string>("");
  const [hasApiKey, setHasApiKey] = useState<boolean>(true);

  // Conversation & Tools State
  const [messages, setMessages] = useState<Message[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [timers, setTimers] = useState<ActiveTimer[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [memory, setMemory] = useState<UserMemoryItem[]>([]);
  const [briefing, setBriefing] = useState<DailyBriefing | null>(null);

  // Cloud & Firebase Authentication State (Priority 2 & 3)
  const [currentUser, setCurrentUser] = useState<{
    uid: string;
    email: string | null;
    displayName: string | null;
    isAnonymous: boolean;
  } | null>(null);
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  // Modals & Panels
  const [isTranscriptOpen, setIsTranscriptOpen] = useState<boolean>(false);
  const [isToolsOpen, setIsToolsOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [isDiagnosticsOpen, setIsDiagnosticsOpen] = useState<boolean>(false);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [micPermError, setMicPermError] = useState<string | null>(null);

  // Settings State (Loaded from localStorage)
  const [settings, setSettings] = useState<VoiceSettings>(() => {
    try {
      const saved = localStorage.getItem("sam_v2_settings");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return {
      voiceName: "Zephyr",
      speechRate: 1.0,
      graphicsQuality: "ultra",
      handsFreeStandby: false,
      micSensitivity: 1.0,
      useNativeLive: true,
      languageMode: "auto",
      enableMemory: true,
      responseStyle: "balanced",
      userLocation: "Hyderabad, Telangana, India",
    };
  });

  // Dynamic Sentiment Theme State
  const [lastSentiment, setLastSentiment] = useState<SentimentTheme>("neutral");

  // Diagnostics State
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData>({
    micPermission: "unknown",
    micCaptureActive: false,
    micSampleRate: 0,
    wsState: "closed",
    liveSupported: false,
    outgoingPackets: 0,
    outgoingBytes: 0,
    outgoingRms: 0,
    lastOutgoingTime: null,
    incomingChunks: 0,
    incomingBytes: 0,
    lastIncomingTime: null,
    lastModelEvent: null,
    playbackState: "idle",
    inputAudioCtxState: "closed",
    outputAudioCtxState: "closed",
    activeSourcesCount: 0,
    activeAudioProvider: "none",
    isWebSpeechSpeaking: false,
    activeResponseId: 0,
    lastAudioStopReason: null,
    lastError: null,
  });

  const voiceControllerRef = useRef<VoiceController | null>(null);
  const recognitionRef = useRef<any>(null);
  const activeUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const assistantStateRef = useRef<AssistantState>("idle");
  assistantStateRef.current = assistantState;
  const handleToolActionRef = useRef<(action: any) => void>(() => {});

  // Real-time user timezone detected via Intl.DateTimeFormat (fallback to Asia/Kolkata)
  const userTimezone = useMemo(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || "Asia/Kolkata";
    } catch {
      return "Asia/Kolkata";
    }
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // 1. Load LocalStorage & Backend Health Check on Mount
  useEffect(() => {
    try {
      const savedMessages = localStorage.getItem("sam_v2_messages");
      if (savedMessages) setMessages(JSON.parse(savedMessages));

      const savedTasks = localStorage.getItem("sam_v2_tasks");
      if (savedTasks) setTasks(JSON.parse(savedTasks));

      const savedNotes = localStorage.getItem("sam_v2_notes");
      if (savedNotes) setNotes(JSON.parse(savedNotes));

      const savedTimers = localStorage.getItem("sam_v2_timers");
      if (savedTimers) setTimers(JSON.parse(savedTimers));

      const savedMemory = localStorage.getItem("sam_v2_memory");
      if (savedMemory) setMemory(JSON.parse(savedMemory));
    } catch (e) {
      console.warn("LocalStorage load error:", e);
    }

    // Check backend health & Gemini status
    fetch("/api/health")
      .then((res) => res.json())
      .then((data) => {
        setHasApiKey(data.hasApiKey);
      })
      .catch((err) => console.warn("Health check error:", err));

    // Fetch initial weather for Hyderabad / default
    fetch("/api/weather?location=Hyderabad")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setWeather(data);
      })
      .catch((err) => console.warn("Initial weather error:", err));

    // Fetch initial daily tech briefing (Priority 4 & 5)
    fetch("/api/briefing")
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) setBriefing(data);
      })
      .catch((err) => console.warn("Briefing error:", err));
  }, []);

  // Firebase Auth & Cloud Firestore Realtime Synchronization Lifecycle (Priority 2 & 3)
  useEffect(() => {
    let unsubNotes: (() => void) | null = null;
    let unsubTasks: (() => void) | null = null;
    let unsubMem: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser({
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || (user.isAnonymous ? "Guest Explorer" : "User"),
          isAnonymous: user.isAnonymous,
        });
        setIsCloudConnected(true);
        setIsSyncing(true);

        try {
          // Controlled one-time migration of local storage data if user has unmigrated items
          const savedTasks = localStorage.getItem("sam_v2_tasks");
          const savedNotes = localStorage.getItem("sam_v2_notes");
          const savedMemory = localStorage.getItem("sam_v2_memory");
          const localTasks = savedTasks ? JSON.parse(savedTasks) : [];
          const localNotes = savedNotes ? JSON.parse(savedNotes) : [];
          const localMem = savedMemory ? JSON.parse(savedMemory) : [];

          if (localTasks.length > 0 || localNotes.length > 0 || localMem.length > 0) {
            await migrateLocalStorageToCloud(user.uid, localTasks, localNotes, localMem);
          }

          // Load cloud settings if present
          const cloudSettings = await loadUserSettings(user.uid);
          if (cloudSettings) {
            setSettings((prev) => ({ ...prev, ...cloudSettings }));
          }
        } catch (err) {
          console.warn("[App] Cloud init notice:", err);
        }

        // Attach realtime Firestore listeners with owner isolation
        unsubNotes = subscribeUserNotes(
          user.uid,
          (cloudNotes) => {
            setNotes(cloudNotes);
            setIsSyncing(false);
            setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          },
          (err) => {
            console.warn("[App] Notes sync error:", err);
            setIsSyncing(false);
          }
        );

        unsubTasks = subscribeUserTasks(
          user.uid,
          (cloudTasks) => {
            setTasks(cloudTasks);
            setIsSyncing(false);
            setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          },
          (err) => {
            console.warn("[App] Tasks sync error:", err);
            setIsSyncing(false);
          }
        );

        unsubMem = subscribeUserMemories(
          user.uid,
          (cloudMem) => {
            setMemory(cloudMem);
            setIsSyncing(false);
            setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
          },
          (err) => {
            console.warn("[App] Memory sync error:", err);
            setIsSyncing(false);
          }
        );
      } else {
        if (unsubNotes) unsubNotes();
        if (unsubTasks) unsubTasks();
        if (unsubMem) unsubMem();
        setCurrentUser(null);
        setIsCloudConnected(false);
        setIsSyncing(false);
      }
    });

    return () => {
      if (unsubNotes) unsubNotes();
      if (unsubTasks) unsubTasks();
      if (unsubMem) unsubMem();
      unsubscribeAuth();
    };
  }, []);

  // Save changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("sam_v2_messages", JSON.stringify(messages.slice(-30)));
    } catch (e) {}
  }, [messages]);

  useEffect(() => {
    try {
      localStorage.setItem("sam_v2_tasks", JSON.stringify(tasks));
    } catch (e) {}
  }, [tasks]);

  useEffect(() => {
    try {
      localStorage.setItem("sam_v2_notes", JSON.stringify(notes));
    } catch (e) {}
  }, [notes]);

  useEffect(() => {
    try {
      localStorage.setItem("sam_v2_timers", JSON.stringify(timers));
    } catch (e) {}
  }, [timers]);

  useEffect(() => {
    try {
      localStorage.setItem("sam_v2_memory", JSON.stringify(memory));
    } catch (e) {}
  }, [memory]);

  useEffect(() => {
    try {
      localStorage.setItem("sam_v2_settings", JSON.stringify(settings));
    } catch (e) {}
    if (voiceControllerRef.current) {
      voiceControllerRef.current.setVoiceName(settings.voiceName);
      voiceControllerRef.current.setSpeechRate(settings.speechRate);
      voiceControllerRef.current.setLanguageMode(settings.languageMode);
    }
    if (currentUser) {
      saveUserSettings(currentUser.uid, settings).catch(() => {});
    }
  }, [settings, currentUser]);

  // 2. Active Countdown Timers Tick Loop
  useEffect(() => {
    const interval = setInterval(() => {
      setTimers((prev) => {
        let changed = false;
        const now = Date.now();
        const updated = prev.map((t) => {
          if (!t.isRunning) return t;
          const left = Math.max(0, Math.round((t.endsAt - now) / 1000));
          if (left !== t.remainingSeconds) {
            changed = true;
            if (left === 0) {
              playTimerChime();
              showToast(`Timer "${t.label}" completed!`);
            }
            return { ...t, remainingSeconds: left, isRunning: left > 0 };
          }
          return t;
        });
        return changed ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const playTimerChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.6);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.6);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } catch (e) {}
  };

  // 3. Initialize VoiceController with Real-Time Callbacks
  useEffect(() => {
    const vc = new VoiceController({
      onStateChange: (state) => {
        setAssistantState(state);
      },
      onAudioLevel: (level) => {
        setAudioLevel(level);
      },
      onTranscript: (text, role, isFinal) => {
        if (text) {
          setLiveSubtitle(text);
          if (role === "assistant" && text.trim().length > 3) {
            setLastSentiment(analyzeSentiment(text));
          }
          setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last && last.role === role && last.isLiveAudio) {
              return [
                ...prev.slice(0, -1),
                {
                  ...last,
                  text: last.text + " " + text,
                  timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                },
              ];
            }
            return [
              ...prev,
              {
                id: Date.now().toString(),
                role: role,
                text,
                timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                isLiveAudio: true,
              },
            ];
          });
        }
      },
      onError: (err) => {
        showToast(err);
        if (err.includes("Microphone access was denied") || err.includes("No microphone")) {
          setMicPermError(err);
        }
      },
      onTurnComplete: () => {
        setLiveSubtitle("");
      },
      onToolAction: (action) => {
        handleToolActionRef.current(action);
      },
      onDiagnosticsUpdate: (data) => {
        setDiagnostics(data);
      },
    });

    vc.setVoiceName(settings.voiceName);
    vc.setSpeechRate(settings.speechRate);
    vc.setLanguageMode(settings.languageMode);
    vc.setClientTimezone(userTimezone);
    vc.setClientLocation(settings.userLocation || "Hyderabad, Telangana, India");
    voiceControllerRef.current = vc;
    setDiagnostics(vc.getDiagnostics());

    // Continuous Speech Recognition Engine with Multilingual Support (English, Hindi, Telugu)
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recog = new SpeechRecognition();
      recog.continuous = true;
      recog.interimResults = true;

      // Select speech recognition language
      if (settings.languageMode === "te") recog.lang = "te-IN";
      else if (settings.languageMode === "hi") recog.lang = "hi-IN";
      else recog.lang = "en-IN";

      recog.onresult = (e: any) => {
        let interimStr = "";
        let finalStr = "";
        for (let i = e.resultIndex; i < e.results.length; ++i) {
          if (e.results[i].isFinal) {
            finalStr += e.results[i][0].transcript;
          } else {
            interimStr += e.results[i][0].transcript;
          }
        }

        // Barge-In: If assistant is speaking and user speaks, immediately interrupt!
        if (assistantStateRef.current === "speaking" && (interimStr.trim() || finalStr.trim())) {
          handleInterrupt();
        }

        const heard = finalStr.trim();
        if (heard) {
          // CRITICAL BUG FIX: If VoiceController is actively in a Gemini Live session,
          // Gemini Live is directly processing the user's microphone stream end-to-end.
          // Suppress SpeechRecognition from firing duplicate chat messages to /api/chat!
          if (voiceControllerRef.current?.isLiveActive()) {
            console.log("[SAM Audio Controller] Suppressed duplicate SpeechRecognition turn while Gemini Live is actively processing microphone audio.");
            return;
          }

          if (settings.handsFreeStandby) {
            const wakeMatch = heard.match(/\b(hey\s+sam|hello\s+sam|ok\s+sam|sam|నమస్కారం\s*శామ్)\b/i);
            if (wakeMatch) {
              const afterWake = heard.substring(wakeMatch.index! + wakeMatch[0].length).trim();
              const cleanQuery = afterWake.replace(/^[,\.\?!]\s*/, "");
              if (cleanQuery) {
                handleSendChatMessage(cleanQuery);
              } else {
                speakAloud(
                  settings.languageMode === "te"
                    ? "నమస్కారం! నేను వింటున్నాను, మీకు ఎలా సహాయపడగలను?"
                    : settings.languageMode === "hi"
                    ? "नमस्ते! मैं सुन रहा हूँ, बताइए क्या सहायता करूँ?"
                    : "I am listening! How may I assist you?"
                );
              }
            }
          } else {
            handleSendChatMessage(heard);
          }
        }
      };

      recog.onerror = (e: any) => {
        if (e.error === "not-allowed") {
          setMicPermError("Microphone access is blocked by your browser settings.");
        }
      };

      recog.onend = () => {
        if (settings.handsFreeStandby && !isListening && recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {}
        }
      };

      recognitionRef.current = recog;
      if (settings.handsFreeStandby && !isListening) {
        try { recog.start(); } catch (e) {}
      }
    }

    return () => {
      vc.stop();
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch (e) {}
      }
    };
  }, []);

  // Update speech recognition language when languageMode changes
  useEffect(() => {
    if (recognitionRef.current) {
      if (settings.languageMode === "te") recognitionRef.current.lang = "te-IN";
      else if (settings.languageMode === "hi") recognitionRef.current.lang = "hi-IN";
      else recognitionRef.current.lang = "en-IN";
    }
  }, [settings.languageMode]);

  // Update voice persona, rate, language & location on controller
  useEffect(() => {
    if (voiceControllerRef.current) {
      voiceControllerRef.current.setVoiceName(settings.voiceName);
      voiceControllerRef.current.setSpeechRate(settings.speechRate);
      voiceControllerRef.current.setLanguageMode(settings.languageMode);
      voiceControllerRef.current.setClientLocation(settings.userLocation || "Hyderabad, Telangana, India");
      voiceControllerRef.current.setClientTimezone(userTimezone);
    }
  }, [settings.voiceName, settings.speechRate, settings.languageMode, settings.userLocation, userTimezone]);

  // Hands-free toggle effect: Only listen for wake-word when NOT actively in a live voice session
  useEffect(() => {
    if (!recognitionRef.current) return;
    if (settings.handsFreeStandby && !isListening) {
      try { recognitionRef.current.start(); } catch (e) {}
    } else {
      try { recognitionRef.current.stop(); } catch (e) {}
    }
  }, [settings.handsFreeStandby, isListening]);

  // 4. Voice Session Toggle with Single Audio Controller Guarantee
  const toggleVoiceSession = async () => {
    if (!voiceControllerRef.current) return;

    if (isListening) {
      voiceControllerRef.current.stop();
      if (recognitionRef.current && !settings.handsFreeStandby) {
        try { recognitionRef.current.stop(); } catch (e) {}
      }
      setIsListening(false);
      setAssistantState("idle");
      showToast("Voice session ended.");
    } else {
      setMicPermError(null);
      const ok = await voiceControllerRef.current.start();
      if (ok) {
        setIsListening(true);
        // Only start SpeechRecognition if Gemini Live is NOT supported (fallback mode).
        // If Live is supported, VoiceController streams directly to Gemini Live!
        const isLive = voiceControllerRef.current.getDiagnostics().liveSupported;
        if (!isLive && recognitionRef.current) {
          try { recognitionRef.current.start(); } catch (e) {}
        }
        showToast("S.A.M. is listening.");
      }
    }
  };

  const handleInterrupt = () => {
    if (voiceControllerRef.current) {
      voiceControllerRef.current.interrupt("user_interrupt");
    }
    setAssistantState("interrupted");
    setLiveSubtitle("");
    showToast("Interrupted.");
    setTimeout(() => {
      if (isListening) setAssistantState("listening");
      else setAssistantState("idle");
    }, 400);
  };

  // 5. Authoritative Speech Synthesis Helper: Plays exactly ONE voice via VoiceController
  const speakAloud = async (text: string, languageHint?: string) => {
    if (!text) return;
    const vc = voiceControllerRef.current;
    if (!vc) return;

    // Detect language of text for accurate synthesis
    const hasTelugu = /[\u0C00-\u0C7F]/.test(text);
    const hasHindi = /[\u0900-\u097F]/.test(text);
    const activeLang = hasTelugu ? "te" : hasHindi ? "hi" : languageHint || settings.languageMode;

    // Try high-quality neural Gemini TTS from /api/tts mediated by VoiceController
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: settings.voiceName, language: activeLang }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.audio) {
          await vc.playWavAudio(data.audio);
          return;
        }
      }
    } catch (e) {
      console.warn("Neural TTS unavailable, falling back to Web Speech:", e);
    }

    // Fallback: Browser Web Speech API executed strictly through VoiceController's authoritative lock
    await vc.speakWithBrowserTTS(text, activeLang, settings.speechRate);
  };

  // 6. Send Chat Message & Process Model Responses + Tool Actions (Streaming + Fallback)
  const handleSendChatMessage = async (text: string) => {
    if (!text.trim()) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: "user",
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    const assistantMsgId = (Date.now() + 1).toString();
    const initialAssistantMsg: Message = {
      id: assistantMsgId,
      role: "assistant",
      text: "",
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isStreaming: true,
    };

    const nextHistory = [...messages, userMsg];
    setMessages([...nextHistory, initialAssistantMsg]);
    setAssistantState("thinking");

    const payload = {
      message: text,
      history: nextHistory.map((m) => ({ role: m.role, text: m.text })),
      clientState: {
        languageMode: settings.languageMode,
        timezone: userTimezone,
        location: settings.userLocation || "Hyderabad, Telangana, India",
        tasksCount: tasks.length,
        notesCount: notes.length,
        memory: settings.enableMemory ? memory : [],
        profile: {
          preferredLanguage: settings.languageMode,
          responseStyle: settings.responseStyle,
          memoryEnabled: settings.enableMemory,
          timezone: userTimezone,
          location: settings.userLocation || "Hyderabad, Telangana, India",
        },
      },
    };

    try {
      const response = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Streaming failed with status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let streamReply = "";
      let toolActionCaptured: any = null;
      let ragSourcesCaptured: any[] | undefined = undefined;
      let webSourcesCaptured: any[] | undefined = undefined;
      let buffer = "";

      setAssistantState("speaking");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith("data: ")) {
            try {
              const event = JSON.parse(trimmed.slice(6));
              if (event.type === "chunk" && event.text) {
                streamReply += event.text;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, text: streamReply, isStreaming: true }
                      : m
                  )
                );
              } else if (event.type === "ragSources" && event.ragSources) {
                ragSourcesCaptured = event.ragSources;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, ragSources: event.ragSources }
                      : m
                  )
                );
              } else if (event.type === "sources" && event.sources) {
                webSourcesCaptured = event.sources;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, sources: event.sources }
                      : m
                  )
                );
              } else if (event.type === "toolAction" && event.toolAction) {
                toolActionCaptured = event.toolAction;
                handleToolAction(event.toolAction);
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === assistantMsgId
                      ? { ...m, toolAction: event.toolAction }
                      : m
                  )
                );
              } else if (event.type === "done") {
                if (event.reply && !streamReply) {
                  streamReply = event.reply;
                }
              }
            } catch (jsonErr) {
              console.warn("SSE json parse error:", jsonErr);
            }
          }
        }
      }

      const finalReply = streamReply || "I have completed your request.";
      const sentiment = analyzeSentiment(finalReply);
      setLastSentiment(sentiment);

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: finalReply,
                isStreaming: false,
                toolAction: toolActionCaptured || m.toolAction,
                ragSources: ragSourcesCaptured || m.ragSources,
                sources: webSourcesCaptured || m.sources,
              }
            : m
        )
      );

      speakAloud(finalReply);
    } catch (streamErr) {
      console.warn("SSE Stream failed, falling back to unary /api/chat:", streamErr);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        const reply = data.reply || "I've processed your request.";
        const sentiment = analyzeSentiment(reply);
        setLastSentiment(sentiment);

        if (data.toolAction) {
          handleToolAction(data.toolAction);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: reply,
                  isStreaming: false,
                  toolAction: data.toolAction,
                  ragSources: data.ragSources,
                  sources: data.sources,
                }
              : m
          )
        );
        speakAloud(reply, data.detectedLang);
      } catch (err: any) {
        console.error("Chat error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: "I encountered an issue reaching the service. Please verify your connection.",
                  isStreaming: false,
                }
              : m
          )
        );
        setAssistantState("error");
        setTimeout(() => setAssistantState("idle"), 2500);
      }
    }
  };

  // Apply Tool Actions into Local Productivity & Memory State
  const handleToolAction = (action: any) => {
    if (!action) return;

    if (action.type === "safe_action") {
      if (action.isAllowed !== false && action.destinationUrl) {
        const destId = action.destinationId || action.domain || action.title || "site";
        const reqId = action.requestId || `action-${destId}-${Date.now()}`;
        const launchRes = launchWebsite(destId, {
          requestId: reqId,
          customUrl: action.destinationUrl,
        });
        if (launchRes.popupBlocked) {
          showToast(`Popup blocked for ${action.title}. Click card below to open.`);
        } else {
          showToast(`Action: ${action.title}`);
        }
      } else {
        showToast(`Action blocked: ${action.blockedReason || "Safety policy restriction"}`);
      }
    } else if (action.type === "task") {
      if (action.action === "create" && action.title) {
        const newTask: Task = {
          id: Date.now().toString(),
          title: action.title,
          completed: false,
          createdAt: new Date().toLocaleDateString(),
        };
        setTasks((prev) => [newTask, ...prev]);
        showToast(`Task added: "${action.title}"`);
      } else if (action.action === "complete" && action.title) {
        setTasks((prev) =>
          prev.map((t) =>
            t.title.toLowerCase().includes(action.title.toLowerCase()) ? { ...t, completed: true } : t
          )
        );
      }
    } else if (action.type === "note") {
      if (action.action === "create" && (action.title || action.content)) {
        handleAddNote(action.title || "Quick Note", action.content || action.title);
      }
    } else if (action.type === "timer" && action.durationSeconds) {
      const duration = Number(action.durationSeconds);
      const newTimer: ActiveTimer = {
        id: Date.now().toString(),
        durationSeconds: duration,
        remainingSeconds: duration,
        label: action.label || "Timer",
        isRunning: true,
        endsAt: Date.now() + duration * 1000,
      };
      setTimers((prev) => [newTimer, ...prev]);
      showToast(`Timer started: ${duration}s`);
    } else if (action.type === "weather" && action.data) {
      setWeather(action.data);
    } else if (action.type === "calculation" && action.result) {
      showToast(`Calculation: ${action.expression} = ${action.result}`);
    } else if (action.type === "memory") {
      if (action.action === "save" && action.key && action.value) {
        handleAddMemory(action.key, action.value, action.category || "fact");
      } else if (action.action === "delete" && action.key) {
        const item = memory.find((m) => m.key.toLowerCase() === action.key.toLowerCase());
        if (item) handleDeleteMemory(item.id);
      }
    } else if (action.type === "time" && action.data) {
      const timeDisplay = action.data.timeShort || action.data.time || "Clock";
      const locDisplay = action.data.locationName || settings.userLocation || "Hyderabad, Telangana, India";
      const tzLabel = action.data.timezoneLabel || "IST";
      showToast(`Clock: ${timeDisplay} (${locDisplay} • ${tzLabel})`);
    } else if (action.type === "language" && action.newLanguage) {
      setSettings((prev) => ({ ...prev, languageMode: action.newLanguage }));
      showToast(`Language switched to ${action.newLanguage.toUpperCase()}`);
    }
  };

  handleToolActionRef.current = handleToolAction;

  // Productivity Handlers (Authoritative Firestore Persistence with Local Fallback)
  const handleAddTask = async (title: string) => {
    const newTask: Task = {
      id: Date.now().toString(),
      title,
      completed: false,
      createdAt: new Date().toLocaleDateString(),
    };
    setTasks((prev) => [newTask, ...prev]);

    if (currentUser) {
      try {
        setIsSyncing(true);
        await saveUserTask(currentUser.uid, newTask);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        showToast(`Task saved to Cloud Firestore`);
      } catch (e: any) {
        console.warn("Task cloud sync error:", e);
        showToast("Task saved locally (Cloud sync failed)");
      } finally {
        setIsSyncing(false);
      }
    } else {
      showToast(`Task added: "${title}"`);
    }
  };

  const handleToggleTask = async (id: string) => {
    const target = tasks.find((t) => t.id === id);
    if (!target) return;
    const updated: Task = { ...target, completed: !target.completed };
    setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)));

    if (currentUser) {
      try {
        setIsSyncing(true);
        await saveUserTask(currentUser.uid, updated);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch (e) {
        console.warn("Toggle task sync error:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleDeleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    if (currentUser) {
      try {
        setIsSyncing(true);
        await deleteUserTask(currentUser.uid, id);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch (e) {
        console.warn("Delete task sync error:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleAddNote = async (title: string, content: string) => {
    const newNote: Note = {
      id: Date.now().toString(),
      title,
      content,
      createdAt: new Date().toLocaleDateString(),
    };
    setNotes((prev) => [newNote, ...prev]);

    if (currentUser) {
      try {
        setIsSyncing(true);
        await saveUserNote(currentUser.uid, newNote);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        showToast(`Note saved to Cloud Firestore`);
      } catch (e) {
        console.warn("Note cloud sync error:", e);
        showToast("Note saved locally (Cloud sync failed)");
      } finally {
        setIsSyncing(false);
      }
    } else {
      showToast(`Note saved: "${newNote.title}"`);
    }
  };

  const handleDeleteNote = async (id: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (currentUser) {
      try {
        setIsSyncing(true);
        await deleteUserNote(currentUser.uid, id);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch (e) {
        console.warn("Delete note sync error:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleAddTimer = (durationSeconds: number, label: string) => {
    const newTimer: ActiveTimer = {
      id: Date.now().toString(),
      durationSeconds,
      remainingSeconds: durationSeconds,
      label,
      isRunning: true,
      endsAt: Date.now() + durationSeconds * 1000,
    };
    setTimers((prev) => [newTimer, ...prev]);
    showToast(`Timer set: ${label} (${Math.round(durationSeconds / 60)}m)`);
  };

  const handleDeleteTimer = (id: string) => {
    setTimers((prev) => prev.filter((t) => t.id !== id));
  };

  const handleRefreshWeather = async (loc?: string) => {
    const query = loc || weather?.location || "Hyderabad";
    try {
      const res = await fetch(`/api/weather?location=${encodeURIComponent(query)}`);
      const data = await res.json();
      if (!data.error) {
        setWeather(data);
        showToast(`Weather updated for ${data.location}`);
      }
    } catch (e) {}
  };

  // Memory Handlers (User-Controlled Persistence per Priority 3)
  const handleAddMemory = async (key: string, value: string, category: "preference" | "profile" | "project" | "fact") => {
    const newItem: UserMemoryItem = {
      id: Date.now().toString(),
      category,
      key,
      value,
      updatedAt: new Date().toLocaleDateString(),
    };
    setMemory((prev) => [newItem, ...prev.filter((m) => m.key !== key)]);

    if (currentUser) {
      try {
        setIsSyncing(true);
        await saveUserMemory(currentUser.uid, newItem);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        showToast(`Memory persisted to Cloud Firestore: "${key}"`);
      } catch (e) {
        console.warn("Memory cloud sync error:", e);
        showToast(`Memory saved locally: "${key}"`);
      } finally {
        setIsSyncing(false);
      }
    } else {
      showToast(`Saved to memory: "${key}"`);
    }
  };

  const handleDeleteMemory = async (id: string) => {
    setMemory((prev) => prev.filter((m) => m.id !== id));
    if (currentUser) {
      try {
        setIsSyncing(true);
        await deleteUserMemory(currentUser.uid, id);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      } catch (e) {
        console.warn("Delete memory sync error:", e);
      } finally {
        setIsSyncing(false);
      }
    }
  };

  const handleClearMemory = async () => {
    if (currentUser && memory.length > 0) {
      try {
        setIsSyncing(true);
        await clearAllUserMemories(currentUser.uid, memory);
      } catch (e) {} finally {
        setIsSyncing(false);
      }
    }
    setMemory([]);
    localStorage.removeItem("sam_v2_memory");
    showToast("Memory cleared.");
  };

  const handleRefreshBriefing = async () => {
    try {
      showToast("Refreshing daily tech briefing...");
      const res = await fetch("/api/refresh/trigger", { method: "POST" });
      const data = await res.json();
      setBriefing(data);
      showToast(`Briefing updated with ${data.items?.length || 0} stories.`);
    } catch (e) {
      showToast("Failed to refresh briefing.");
    }
  };

  const handleUpdateMemory = async (id: string, value: string) => {
    const target = memory.find((m) => m.id === id);
    if (!target) return;
    const updated: UserMemoryItem = {
      ...target,
      value,
      updatedAt: new Date().toLocaleDateString(),
    };
    setMemory((prev) => prev.map((m) => (m.id === id ? updated : m)));

    if (currentUser) {
      try {
        setIsSyncing(true);
        await saveUserMemory(currentUser.uid, updated);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        showToast("Memory updated in Cloud Firestore");
      } catch (e) {
        console.warn("Memory update error:", e);
      } finally {
        setIsSyncing(false);
      }
    } else {
      showToast("Memory updated locally");
    }
  };

  const handleExportBackup = () => {
    exportUserDataAsJSON({
      version: "2.0",
      exportDate: new Date().toISOString(),
      userId: currentUser?.uid || "local-user",
      tasks,
      notes,
      memory,
    });
    showToast("JSON backup downloaded.");
  };

  const handleRestoreBackup = async (backupData: any) => {
    try {
      if (!backupData || typeof backupData !== "object") {
        showToast("Invalid backup file format");
        return;
      }
      const restoredTasks = Array.isArray(backupData.tasks) ? backupData.tasks : [];
      const restoredNotes = Array.isArray(backupData.notes) ? backupData.notes : [];
      const restoredMemory = Array.isArray(backupData.memory) ? backupData.memory : [];

      setTasks(restoredTasks);
      setNotes(restoredNotes);
      setMemory(restoredMemory);

      if (currentUser) {
        setIsSyncing(true);
        await migrateLocalStorageToCloud(currentUser.uid, restoredTasks, restoredNotes, restoredMemory);
        setLastSyncedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
        showToast(`Restored & synced ${restoredTasks.length + restoredNotes.length + restoredMemory.length} items to Cloud!`);
      } else {
        localStorage.setItem("sam_v2_tasks", JSON.stringify(restoredTasks));
        localStorage.setItem("sam_v2_notes", JSON.stringify(restoredNotes));
        localStorage.setItem("sam_v2_memory", JSON.stringify(restoredMemory));
        showToast(`Restored ${restoredTasks.length + restoredNotes.length + restoredMemory.length} items from backup!`);
      }
    } catch (err: any) {
      console.error("Restore error:", err);
      showToast("Failed to restore backup: " + (err?.message || "error"));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem("sam_v2_messages");
    showToast("Conversation cleared.");
  };

  const handleClearAllData = async () => {
    if (currentUser) {
      try {
        await clearAllUserMemories(currentUser.uid, memory);
        for (const t of tasks) await deleteUserTask(currentUser.uid, t.id);
        for (const n of notes) await deleteUserNote(currentUser.uid, n.id);
      } catch (e) {}
    }
    setMessages([]);
    setTasks([]);
    setNotes([]);
    setTimers([]);
    setMemory([]);
    localStorage.clear();
    setIsSettingsOpen(false);
    showToast("All assistant data cleared.");
  };

  const handleDownloadTranscript = () => {
    if (messages.length === 0) {
      showToast("No conversation to export.");
      return;
    }
    let txt = `=== S.A.M. MULTILINGUAL ASSISTANT TRANSCRIPT ===\nExport Date: ${new Date().toLocaleString()}\nLanguage Mode: ${settings.languageMode}\n\n`;
    messages.forEach((m) => {
      txt += `[${m.timestamp}] ${m.role === "user" ? "User" : "S.A.M."}:\n${m.text}\n\n`;
    });
    const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sam-transcript.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Transcript downloaded.");
  };

  // Sentiment-driven dynamic ambient background glow
  const getAmbientGlowClasses = () => {
    switch (assistantState) {
      case "listening":
        return "from-emerald-500/22 via-cyan-500/12 to-transparent";
      case "thinking":
        return "from-purple-600/25 via-indigo-500/15 to-transparent";
      case "connecting":
        return "from-sky-500/20 via-blue-500/10 to-transparent";
      case "error":
        return "from-rose-600/25 via-rose-500/10 to-transparent";
      case "speaking":
      case "idle":
      default:
        return THEME_PALETTES[lastSentiment].ambientGlow;
    }
  };

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col font-sans select-none antialiased">
      {/* State & Sentiment Driven Ambient Radial Glow */}
      <div
        className={`pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[800px] h-[700px] rounded-full bg-gradient-to-b ${getAmbientGlowClasses()} blur-3xl opacity-80 transition-all duration-1000 -z-10`}
      />

      {/* Subtle Starfield / Grid Texture */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:24px_24px] opacity-40 -z-10" />

      {/* Floating System Toast */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-slate-900/90 border border-cyan-500/40 text-xs font-medium text-cyan-200 shadow-[0_4px_20px_rgba(6,182,212,0.3)] backdrop-blur-xl animate-fade-in">
          {toastMessage}
        </div>
      )}

      {/* Mic Permission Guidance Alert Banner */}
      {micPermError && (
        <div className="relative z-40 bg-rose-950/80 border-b border-rose-800/80 px-4 py-2.5 text-xs text-rose-200 flex items-center justify-between backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-2 max-w-2xl">
            <ShieldAlert size={16} className="text-rose-400 shrink-0" />
            <span>{micPermError}</span>
          </div>
          <button
            onClick={() => setMicPermError(null)}
            className="text-rose-400 hover:text-white px-2 py-0.5 rounded cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Cinematic Header Bar with Language Switcher */}
      <Header
        state={assistantState}
        hasApiKey={hasApiKey}
        languageMode={settings.languageMode}
        onChangeLanguage={(lang) => {
          setSettings((prev) => ({ ...prev, languageMode: lang }));
          showToast(`Language set to ${lang === "te" ? "Telugu (తెలుగు)" : lang === "hi" ? "Hindi (हिन्दी)" : lang === "en" ? "English" : "Auto-Detect"}`);
        }}
        tasksCount={tasks.filter((t) => !t.completed).length}
        notesCount={notes.length}
        activeTimersCount={timers.filter((t) => t.isRunning).length}
        isTranscriptOpen={isTranscriptOpen}
        currentUser={currentUser}
        isSyncing={isSyncing}
        onOpenAuth={() => setIsAuthOpen(true)}
        onToggleTranscript={() => setIsTranscriptOpen(!isTranscriptOpen)}
        onOpenTools={() => setIsToolsOpen(true)}
        onOpenSettings={() => setIsSettingsOpen(true)}
        onClearChat={handleClearChat}
        onDownloadTranscript={handleDownloadTranscript}
      />

      {/* Main Focal Experience */}
      <main className="flex-1 relative flex flex-col justify-between items-center px-4 overflow-hidden">
        {/* Central 3D Energy Orb */}
        <div className="relative flex-1 w-full max-w-2xl flex flex-col items-center justify-center -mt-2">
          <ThreeOrb
            state={assistantState}
            audioLevel={audioLevel}
            quality={settings.graphicsQuality}
            sentiment={lastSentiment}
            onClick={() => {
              if (assistantState === "speaking") {
                handleInterrupt();
              } else {
                toggleVoiceSession();
              }
            }}
          />

          {/* Minimal State Capsule Indicator & Sentiment Badge */}
          <div className="mt-2 text-center pointer-events-none z-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900/60 border border-white/[0.08] backdrop-blur-xl shadow-lg">
              <span
                className={`w-2 h-2 rounded-full ${
                  assistantState === "listening"
                    ? "bg-emerald-400 animate-ping"
                    : assistantState === "speaking"
                    ? "bg-amber-400 animate-pulse"
                    : assistantState === "thinking"
                    ? "bg-purple-400 animate-bounce"
                    : assistantState === "connecting"
                    ? "bg-sky-400 animate-pulse"
                    : assistantState === "error"
                    ? "bg-rose-500"
                    : "bg-cyan-400"
                }`}
              />
              <span className="text-xs font-semibold tracking-wider text-slate-200 capitalize">
                {assistantState === "listening"
                  ? `Listening (${settings.languageMode.toUpperCase()})`
                  : assistantState === "speaking"
                  ? "Speaking..."
                  : assistantState === "thinking"
                  ? "Reasoning..."
                  : assistantState === "connecting"
                  ? "Connecting to Voice Bridge..."
                  : assistantState === "error"
                  ? "Connection Alert"
                  : "S.A.M. Ready"}
              </span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all duration-700 ${THEME_PALETTES[lastSentiment].badgeColor}`}>
                {THEME_PALETTES[lastSentiment].label}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-1 font-normal tracking-wide">
              {assistantState === "speaking"
                ? "Click orb or speak to interrupt"
                : isListening
                ? "Speak naturally in English, Hindi, or Telugu"
                : "Click orb or say 'Hey Sam' to begin"}
            </p>
          </div>
        </div>

        {/* Collapsible / Expandable Conversation Transcript */}
        {isTranscriptOpen && (
          <div className="w-full flex-1 max-h-[35vh] flex flex-col z-20 mb-2 animate-fade-in">
            <ChatPanel
              messages={messages}
              isOpen={isTranscriptOpen}
              onReplaySpeech={speakAloud}
              onTaskToggle={(title) => {
                const matched = tasks.find((t) => t.title === title);
                if (matched) handleToggleTask(matched.id);
              }}
            />
          </div>
        )}

        {/* Compact Quick Actions Hub (12 Verified Destinations, Search, Notes, Tasks, Timers) */}
        <QuickActions
          onExecuteAction={handleToolAction}
          onAddTask={handleAddTask}
          onAddNote={handleAddNote}
          onStartTimer={(secs, label) => handleAddTimer(secs, label)}
          onSearchWeb={(query) => handleSendChatMessage(`Search Google for ${query}`)}
        />

        {/* Ergonomic Unified Bottom Control Dock */}
        <ControlsDock
          state={assistantState}
          isListening={isListening}
          liveSubtitle={liveSubtitle}
          onToggleVoice={toggleVoiceSession}
          onInterrupt={handleInterrupt}
          onSendMessage={handleSendChatMessage}
          onSelectSuggestion={handleSendChatMessage}
        />
      </main>

      {/* Productivity & Memory Tools Drawer */}
      <ToolsDrawer
        isOpen={isToolsOpen}
        onClose={() => setIsToolsOpen(false)}
        tasks={tasks}
        notes={notes}
        timers={timers}
        weather={weather}
        memory={memory}
        briefing={briefing}
        isCloudConnected={isCloudConnected}
        lastSyncedAt={lastSyncedAt}
        onAddTask={handleAddTask}
        onToggleTask={handleToggleTask}
        onDeleteTask={handleDeleteTask}
        onAddNote={handleAddNote}
        onDeleteNote={handleDeleteNote}
        onAddTimer={handleAddTimer}
        onDeleteTimer={handleDeleteTimer}
        onRefreshWeather={handleRefreshWeather}
        onRefreshBriefing={handleRefreshBriefing}
        onAddMemory={handleAddMemory}
        onDeleteMemory={handleDeleteMemory}
        onUpdateMemory={handleUpdateMemory}
        onClearMemory={handleClearMemory}
        onExportBackup={handleExportBackup}
        onRestoreBackup={handleRestoreBackup}
        onTriggerCommand={handleSendChatMessage}
      />

      {/* Authentication & Cloud Sync Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        currentUser={currentUser}
        onAuthSuccess={(msg) => showToast(msg)}
      />

      {/* System, Voice, Language & Memory Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={(newVals) => setSettings((prev) => ({ ...prev, ...newVals }))}
        onTestVoice={() => {
          const testMsg =
            settings.languageMode === "te"
              ? `నమస్కారం! నేను S.A.M. ని, ${settings.voiceName} స్వరంలో మాట్లాడుతున్నాను.`
              : settings.languageMode === "hi"
              ? `नमस्ते! मैं S.A.M. हूँ, ${settings.voiceName} आवाज़ में बोल रहा हूँ।`
              : `Hello! This is S.A.M. speaking at ${settings.speechRate.toFixed(1)}x speed using the ${settings.voiceName} persona.`;
          speakAloud(testMsg);
        }}
        onClearAllData={handleClearAllData}
        savedMemoriesCount={memory.length}
        onClearMemory={handleClearMemory}
        onInterrupt={() => voiceControllerRef.current?.interrupt("settings_preview")}
        onOpenDiagnostics={() => {
          setIsSettingsOpen(false);
          setIsDiagnosticsOpen(true);
        }}
        diagnostics={diagnostics}
      />

      {/* Developer Diagnostics Panel */}
      <DiagnosticsPanel
        isOpen={isDiagnosticsOpen}
        onClose={() => setIsDiagnosticsOpen(false)}
        diagnostics={diagnostics}
        onTestMic={() => {
          if (voiceControllerRef.current) {
            voiceControllerRef.current.checkPermissionStatus().then((status) => {
              showToast(`Microphone permission: ${status}`);
            });
          }
        }}
        onReconnect={() => {
          if (voiceControllerRef.current) {
            voiceControllerRef.current.connectWebSocket().then(() => {
              showToast("Reconnected WebSocket bridge.");
            });
          }
        }}
        onResumeAudio={() => {
          if (voiceControllerRef.current) {
            voiceControllerRef.current.resumeAudioContext().then(() => {
              showToast("AudioContext resumed.");
            });
          }
        }}
        onResetCounters={() => {
          if (voiceControllerRef.current) {
            voiceControllerRef.current.resetDiagnosticsCounters();
            showToast("Diagnostics packet counters reset.");
          }
        }}
      />
    </div>
  );
}
