export type AssistantState =
  | "idle"
  | "connecting"
  | "listening"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "error";

export type LanguageMode = "auto" | "en" | "hi" | "te";

export interface UserMemoryItem {
  id: string;
  category: "preference" | "profile" | "project" | "fact";
  key: string;
  value: string;
  updatedAt: string;
}

export interface UserProfile {
  userName?: string;
  assistantName?: string;
  preferredLanguage: LanguageMode;
  responseStyle?: "concise" | "balanced" | "detailed";
  memoryEnabled: boolean;
}

export interface GroundingSource {
  title: string;
  url: string;
  domain?: string;
}

export interface RagCitation {
  docTitle: string;
  chunkId: string;
  score: number;
  snippet?: string;
}

export interface ToolActionPayload {
  type:
    | "time"
    | "weather"
    | "note"
    | "task"
    | "timer"
    | "reminder"
    | "calculation"
    | "memory"
    | "language"
    | "briefing"
    | "safe_action"
    | "rag";
  data?: any;
  action?: string;
  title?: string;
  content?: string;
  id?: string;
  durationSeconds?: number;
  label?: string;
  message?: string;
  timeDescription?: string;
  expression?: string;
  result?: string;
  explanation?: string;
  key?: string;
  value?: string;
  category?: string;
  newLanguage?: LanguageMode;
  detectedEmotion?: string;
  // Safe action specific fields
  description?: string;
  destinationId?: string;
  destinationUrl?: string;
  domain?: string;
  buttonLabel?: string;
  isAllowed?: boolean;
  blockedReason?: string;
  requestId?: string;
  popupBlocked?: boolean;
}

export interface TechNewsItem {
  id: number;
  title: string;
  url: string;
  score: number;
  by: string;
  retrievedAt: string;
  source: string;
}

export interface DailyBriefing {
  status: "idle" | "success" | "error";
  lastSuccessfulRefresh: string | null;
  refreshCount: number;
  durationMs: number;
  items: TechNewsItem[];
  error?: string;
}

export interface AuthState {
  user: {
    uid: string;
    email: string | null;
    displayName: string | null;
    isAnonymous: boolean;
  } | null;
  isInitializing: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncError: string | null;
  isOnline: boolean;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  isLiveAudio?: boolean;
  isStreaming?: boolean;
  languageDetected?: LanguageMode;
  inferredEmotion?: string;
  toolAction?: ToolActionPayload;
  sources?: GroundingSource[];
  ragSources?: RagCitation[];
}

export interface Note {
  id: string;
  title: string;
  content: string;
  createdAt: string;
}

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
}

export interface ActiveTimer {
  id: string;
  durationSeconds: number;
  remainingSeconds: number;
  label: string;
  isRunning: boolean;
  endsAt: number;
}

export interface Reminder {
  id: string;
  message: string;
  timeDescription: string;
  createdAt: string;
  triggered?: boolean;
}

export interface WeatherInfo {
  location: string;
  temperatureC: number;
  temperatureF: number;
  feelsLikeC: number;
  feelsLikeF: number;
  condition: string;
  humidity: number;
  windSpeedKmh: number;
  maxTempC?: number;
  minTempC?: number;
  error?: string;
}

export type VoiceGender = "female" | "male" | "neutral";

export interface VoiceOption {
  name: "Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede";
  gender: VoiceGender;
  tone: string;
  description: string;
  recommendedRole: string;
}

export interface VoiceSettings {
  voiceName: "Zephyr" | "Puck" | "Charon" | "Kore" | "Fenrir" | "Aoede";
  speechRate: number;
  graphicsQuality: "ultra" | "balanced" | "minimal";
  handsFreeStandby: boolean;
  micSensitivity: number;
  useNativeLive: boolean;
  languageMode: LanguageMode;
  enableMemory: boolean;
  responseStyle: "concise" | "balanced" | "detailed";
  userLocation?: string;
}

export type AudioOutputProvider = "none" | "gemini_live" | "gemini_tts" | "browser_tts";

export interface DiagnosticsData {
  micPermission: "granted" | "denied" | "prompt" | "unknown";
  micCaptureActive: boolean;
  micSampleRate: number;
  wsState: "connected" | "connecting" | "closed" | "error";
  liveSupported: boolean;
  outgoingPackets: number;
  outgoingBytes: number;
  outgoingRms: number;
  lastOutgoingTime: string | null;
  incomingChunks: number;
  incomingBytes: number;
  lastIncomingTime: string | null;
  lastModelEvent: string | null;
  playbackState: "idle" | "playing" | "buffering";
  inputAudioCtxState: string;
  outputAudioCtxState: string;
  activeSourcesCount: number;
  activeAudioProvider: AudioOutputProvider;
  isWebSpeechSpeaking: boolean;
  activeResponseId: number;
  lastAudioStopReason: string | null;
  lastError: string | null;
}
