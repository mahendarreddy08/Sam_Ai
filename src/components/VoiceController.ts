// VoiceController.ts - Real-Time Gemini Live Audio Engine & Web Audio Pipeline with Real Diagnostics

import { DiagnosticsData, AudioOutputProvider } from "../types";

export interface VoiceControllerCallbacks {
  onStateChange: (state: "idle" | "connecting" | "listening" | "thinking" | "speaking" | "interrupted" | "error") => void;
  onAudioLevel: (level: number) => void;
  onTranscript: (text: string, role: "user" | "assistant", isFinal?: boolean) => void;
  onError: (error: string) => void;
  onTurnComplete?: () => void;
  onDiagnosticsUpdate?: (data: DiagnosticsData) => void;
  onToolAction?: (action: any) => void;
}

export class VoiceController {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private micStream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private muteGain: GainNode | null = null;
  private inputAnalyser: AnalyserNode | null = null;
  private outputAnalyser: AnalyserNode | null = null;
  private activeSources: AudioBufferSourceNode[] = [];
  private nextPlayTime: number = 0;
  private isListening: boolean = false;
  private isSpeaking: boolean = false;
  private animFrameId: number | null = null;
  private callbacks: VoiceControllerCallbacks;
  private isLiveSupported: boolean = true;
  private voiceName: string = "Zephyr";
  private speechRate: number = 1.0;
  private languageMode: string = "auto";
  private clientTimezone: string = "Asia/Kolkata";
  private clientLocation: string = "Hyderabad, Telangana, India";

  // Authoritative Single-Audio-Output State
  private activeProvider: AudioOutputProvider = "none";
  private activeResponseId: number = 0;
  private lastAudioStopReason: string | null = null;
  private isLiveTurnActive: boolean = false;
  private suppressIncomingLiveUntilTurnComplete: boolean = false;

  // Real Diagnostics Metrics (Never mocked)
  private diagnostics: DiagnosticsData = {
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
  };

  constructor(callbacks: VoiceControllerCallbacks) {
    this.callbacks = callbacks;
    this.checkPermissionStatus();
  }

  // Authoritative Provider Lock: returns true if Gemini Live session is connected and active
  public isLiveActive(): boolean {
    return this.isListening && this.isLiveSupported && !!(this.ws && this.ws.readyState === WebSocket.OPEN);
  }

  public getActiveAudioProvider(): AudioOutputProvider {
    return this.activeProvider;
  }

  public getActiveResponseId(): number {
    return this.activeResponseId;
  }

  /**
   * Acquire authoritative audio playback slot for a single provider.
   * Halts and cancels any other active speech system (Live chunks, neural TTS, Web Speech).
   * Monotonically increments activeResponseId so any stale chunks are discarded.
   */
  public acquirePlaybackSlot(provider: AudioOutputProvider): number {
    const newId = ++this.activeResponseId;

    // 1. Stop all active Web Audio buffer sources
    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop(0);
        source.disconnect();
      } catch (e) {}
    }
    this.activeSources = [];

    // 2. Cancel browser speech synthesis if active
    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    // 3. Reset output timeline
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }

    this.activeProvider = provider;
    this.isSpeaking = true;
    this.diagnostics.activeAudioProvider = provider;
    this.diagnostics.activeResponseId = newId;
    this.diagnostics.playbackState = "playing";
    this.diagnostics.isWebSpeechSpeaking = provider === "browser_tts";
    this.diagnostics.activeSourcesCount = 0;
    this.callbacks.onStateChange("speaking");
    this.notifyDiagnostics();

    return newId;
  }

  /**
   * Release authoritative playback slot once the turn or audio stream completes.
   */
  public releasePlaybackSlot(responseId: number, reason: string = "completed") {
    if (responseId !== this.activeResponseId) {
      // Ignored: this playback was already superseded by a newer response
      return;
    }

    this.activeProvider = "none";
    this.isSpeaking = false;
    this.lastAudioStopReason = reason;
    this.diagnostics.activeAudioProvider = "none";
    this.diagnostics.playbackState = "idle";
    this.diagnostics.isWebSpeechSpeaking = false;
    this.diagnostics.lastAudioStopReason = reason;
    this.diagnostics.activeSourcesCount = 0;

    if (this.isListening) {
      this.callbacks.onStateChange("listening");
    } else {
      this.callbacks.onStateChange("idle");
    }
    this.notifyDiagnostics();
  }

  public setVoiceName(voice: string) {
    if (this.voiceName !== voice) {
      this.interrupt("voice_changed");
    }
    this.voiceName = voice;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: "setVoice",
          voiceName: voice,
        }));
      } catch (e) {
        console.warn("Error sending setVoice message:", e);
      }
    }
  }

  public setSpeechRate(rate: number) {
    this.speechRate = Math.max(0.5, Math.min(2.0, rate));
  }

  public setLanguageMode(lang: string) {
    this.languageMode = lang;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: "configure",
          language: lang,
          voiceName: this.voiceName,
          timezone: this.clientTimezone,
          location: this.clientLocation,
        }));
      } catch (e) {}
    }
  }

  public setClientTimezone(tz: string) {
    this.clientTimezone = tz || "Asia/Kolkata";
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: "configure",
          language: this.languageMode,
          voiceName: this.voiceName,
          timezone: this.clientTimezone,
          location: this.clientLocation,
        }));
      } catch (e) {}
    }
  }

  public setClientLocation(loc: string) {
    this.clientLocation = loc || "Hyderabad, Telangana, India";
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          type: "configure",
          language: this.languageMode,
          voiceName: this.voiceName,
          timezone: this.clientTimezone,
          location: this.clientLocation,
        }));
      } catch (e) {}
    }
  }

  public getDiagnostics(): DiagnosticsData {
    return {
      ...this.diagnostics,
      activeSourcesCount: this.activeSources.length,
      inputAudioCtxState: this.inputAudioCtx ? this.inputAudioCtx.state : "closed",
      outputAudioCtxState: this.outputAudioCtx ? this.outputAudioCtx.state : "closed",
      playbackState: this.isSpeaking ? "playing" : "idle",
      activeAudioProvider: this.activeProvider,
      activeResponseId: this.activeResponseId,
      lastAudioStopReason: this.lastAudioStopReason,
      micCaptureActive: !!(this.micStream && this.micStream.active && this.micStream.getAudioTracks().some(t => t.enabled)),
      micSampleRate: this.inputAudioCtx ? this.inputAudioCtx.sampleRate : 0,
    };
  }

  private notifyDiagnostics() {
    if (this.callbacks.onDiagnosticsUpdate) {
      this.callbacks.onDiagnosticsUpdate(this.getDiagnostics());
    }
  }

  // Query browser permission status if supported
  public async checkPermissionStatus(): Promise<DiagnosticsData["micPermission"]> {
    try {
      if (navigator.permissions && navigator.permissions.query) {
        const status = await navigator.permissions.query({ name: "microphone" as PermissionName });
        this.diagnostics.micPermission = status.state as any;
        status.onchange = () => {
          this.diagnostics.micPermission = status.state as any;
          this.notifyDiagnostics();
        };
        this.notifyDiagnostics();
        return this.diagnostics.micPermission;
      }
    } catch (e) {
      // Some browsers (e.g. Firefox or Safari) don't support permissions.query for microphone
    }
    return this.diagnostics.micPermission;
  }

  // Linear resampler to guarantee exact 16,000 Hz 16-bit PCM for Gemini Live
  private resampleTo16kPCM(inputData: Float32Array, inputSampleRate: number): { pcm16: Int16Array; base64: string } {
    let pcm16: Int16Array;

    if (inputSampleRate === 16000) {
      pcm16 = new Int16Array(inputData.length);
      for (let i = 0; i < inputData.length; i++) {
        const s = Math.max(-1, Math.min(1, inputData[i]));
        pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
      }
    } else {
      const ratio = inputSampleRate / 16000;
      const targetLength = Math.round(inputData.length / ratio);
      pcm16 = new Int16Array(targetLength);
      let offsetResult = 0;
      let offsetInput = 0;

      while (offsetResult < targetLength) {
        const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
        let accum = 0;
        let count = 0;
        for (let i = offsetInput; i < nextOffsetInput && i < inputData.length; i++) {
          accum += inputData[i];
          count++;
        }
        const sample = count > 0 ? accum / count : inputData[offsetInput] || 0;
        const clamped = Math.max(-1, Math.min(1, sample));
        pcm16[offsetResult] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
        offsetResult++;
        offsetInput = nextOffsetInput;
      }
    }

    // Convert Int16Array to base64 string
    const uint8 = new Uint8Array(pcm16.buffer, pcm16.byteOffset, pcm16.byteLength);
    let binary = "";
    const len = uint8.length;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(uint8[i]);
    }
    const base64 = btoa(binary);

    return { pcm16, base64 };
  }

  // Start real-time voice session
  public async start(): Promise<boolean> {
    try {
      this.callbacks.onStateChange("connecting");

      // 1. Request microphone access with actionable permission handling
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            channelCount: 1,
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
          video: false,
        });
        this.diagnostics.micPermission = "granted";
      } catch (micErr: any) {
        let msg = "Microphone access failed.";
        this.diagnostics.micPermission = "denied";
        if (micErr.name === "NotAllowedError" || micErr.name === "PermissionDeniedError") {
          msg = "Microphone access was denied. Please allow microphone access in your browser's address bar (click the lock/tune icon) to speak with S.A.M.";
        } else if (micErr.name === "NotFoundError" || micErr.name === "DevicesNotFoundError") {
          msg = "No microphone hardware detected on this device. Please connect a microphone or use the text prompt below.";
        } else if (micErr.name === "NotReadableError" || micErr.name === "TrackStartError") {
          msg = "Microphone is currently in use by another application. Please close other voice apps and retry.";
        } else if (micErr.name === "SecurityError") {
          msg = "Microphone access is blocked by security policy or iframe restrictions.";
        } else {
          msg = `Microphone error: ${micErr.message || micErr.name}`;
        }
        this.diagnostics.lastError = msg;
        this.notifyDiagnostics();
        this.callbacks.onError(msg);
        this.callbacks.onStateChange("error");
        return false;
      }

      this.micStream = stream;
      this.diagnostics.micCaptureActive = true;

      // 2. Initialize AudioContext for microphone capture
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.inputAudioCtx = new AudioCtx();
      if (this.inputAudioCtx.state === "suspended") {
        await this.inputAudioCtx.resume();
      }
      this.diagnostics.micSampleRate = this.inputAudioCtx.sampleRate;
      this.diagnostics.inputAudioCtxState = this.inputAudioCtx.state;

      // Initialize AudioContext for 24kHz Gemini Live audio output playback
      this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      if (this.outputAudioCtx.state === "suspended") {
        await this.outputAudioCtx.resume();
      }
      this.diagnostics.outputAudioCtxState = this.outputAudioCtx.state;

      // 3. Connect microphone to input analyser for real-time visualizer
      const source = this.inputAudioCtx.createMediaStreamSource(stream);
      const analyser = this.inputAudioCtx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.75;
      this.inputAnalyser = analyser;

      // 4. Connect ScriptProcessor to stream resampled 16kHz 16-bit PCM
      const bufferSize = 2048;
      const processor = this.inputAudioCtx.createScriptProcessor(bufferSize, 1, 1);
      this.processor = processor;

      // Crucial: Route processor through a muted gain node to prevent speaker feedback!
      const muteGain = this.inputAudioCtx.createGain();
      muteGain.gain.value = 0;
      this.muteGain = muteGain;

      source.connect(analyser);
      analyser.connect(processor);
      processor.connect(muteGain);
      muteGain.connect(this.inputAudioCtx.destination);

      processor.onaudioprocess = (e) => {
        if (!this.isListening) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const { pcm16, base64 } = this.resampleTo16kPCM(inputData, this.inputAudioCtx!.sampleRate);

        // Calculate real-time RMS for diagnostics
        let sum = 0;
        for (let i = 0; i < inputData.length; i++) {
          sum += inputData[i] * inputData[i];
        }
        const rms = Math.sqrt(sum / inputData.length);
        this.diagnostics.outgoingRms = rms;

        if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isLiveSupported) {
          this.ws.send(JSON.stringify({ type: "audio", data: base64 }));
          this.diagnostics.outgoingPackets += 1;
          this.diagnostics.outgoingBytes += pcm16.byteLength;
          this.diagnostics.lastOutgoingTime = new Date().toLocaleTimeString();
        }
      };

      // 5. Connect output analyser for model playback
      const outAnalyser = this.outputAudioCtx.createAnalyser();
      outAnalyser.fftSize = 256;
      this.outputAnalyser = outAnalyser;
      outAnalyser.connect(this.outputAudioCtx.destination);

      // 6. Connect WebSocket to backend /live bridge
      await this.connectWebSocket();

      // Start audio level loop
      this.startAudioLevelLoop();

      this.isListening = true;
      this.callbacks.onStateChange("listening");
      this.notifyDiagnostics();
      return true;
    } catch (err: any) {
      console.error("VoiceController start error:", err);
      const errMsg = err?.message || "Failed to initialize voice session.";
      this.diagnostics.lastError = errMsg;
      this.notifyDiagnostics();
      this.callbacks.onError(errMsg);
      this.callbacks.onStateChange("error");
      this.stop();
      return false;
    }
  }

  // Connect to backend WebSocket bridge
  public connectWebSocket(): Promise<void> {
    return new Promise((resolve) => {
      // Clean up previous connection if present
      if (this.ws) {
        try {
          this.ws.onclose = null;
          this.ws.onerror = null;
          this.ws.onmessage = null;
          this.ws.close();
        } catch (e) {}
        this.ws = null;
      }

      this.interrupt("reconnecting");
      this.diagnostics.wsState = "connecting";
      this.notifyDiagnostics();

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/live`;

      const ws = new WebSocket(wsUrl);
      this.ws = ws;

      ws.onopen = () => {
        console.log("WebSocket connected to /live");
        this.diagnostics.wsState = "connected";
        this.notifyDiagnostics();
        try {
          ws.send(JSON.stringify({
            type: "configure",
            language: this.languageMode,
            voiceName: this.voiceName,
            timezone: this.clientTimezone,
            location: this.clientLocation,
          }));
        } catch (e) {}
        resolve();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);

          if (msg.type === "mode" && msg.liveSupported === false) {
            this.isLiveSupported = false;
            this.diagnostics.liveSupported = false;
            this.diagnostics.lastModelEvent = "fallbackMode";
            this.notifyDiagnostics();
            console.log("Operating in fallback audio mode");
          } else if (msg.type === "sessionReady") {
            this.isLiveSupported = true;
            this.diagnostics.liveSupported = true;
            this.diagnostics.lastModelEvent = "sessionReady";
            this.notifyDiagnostics();
            this.callbacks.onStateChange("listening");
          } else if (msg.type === "toolAction" && msg.toolAction) {
            this.diagnostics.lastModelEvent = `toolAction:${msg.toolAction.type}`;
            this.notifyDiagnostics();
            if (this.callbacks.onToolAction) {
              this.callbacks.onToolAction(msg.toolAction);
            }
          } else if (msg.type === "audio" && msg.audio) {
            this.diagnostics.incomingChunks += 1;
            this.diagnostics.incomingBytes += Math.round(msg.audio.length * 0.75);
            this.diagnostics.lastIncomingTime = new Date().toLocaleTimeString();
            this.diagnostics.lastModelEvent = "modelAudioChunk";
            this.handleIncomingAudioChunk(msg.audio);
          } else if (msg.type === "transcript" && msg.text) {
            this.diagnostics.lastModelEvent = "transcript";
            this.callbacks.onTranscript(msg.text, msg.role || "assistant", false);
          } else if (msg.type === "interrupted") {
            this.diagnostics.lastModelEvent = "interrupted";
            this.isLiveTurnActive = false;
            this.suppressIncomingLiveUntilTurnComplete = false;
            this.interrupt("server_interrupted");
            this.callbacks.onStateChange("interrupted");
            setTimeout(() => {
              if (this.isListening) this.callbacks.onStateChange("listening");
            }, 300);
          } else if (msg.type === "turnComplete") {
            this.diagnostics.lastModelEvent = "turnComplete";
            this.isLiveTurnActive = false;
            this.suppressIncomingLiveUntilTurnComplete = false;
            if (this.callbacks.onTurnComplete) this.callbacks.onTurnComplete();
            if (this.activeSources.length === 0 && this.activeProvider === "gemini_live") {
              this.releasePlaybackSlot(this.activeResponseId, "live_turn_complete");
            }
          } else if (msg.type === "error") {
            this.diagnostics.lastError = msg.message || "Live API error";
            this.diagnostics.lastModelEvent = "error";
            this.notifyDiagnostics();
            console.warn("Live API message error:", msg.message);
          }
          this.notifyDiagnostics();
        } catch (e) {
          console.warn("WebSocket message parse error:", e);
        }
      };

      ws.onerror = (e) => {
        console.warn("WebSocket connection error:", e);
        this.diagnostics.wsState = "error";
        this.diagnostics.lastError = "WebSocket error connecting to /live";
        this.isLiveSupported = false;
        this.diagnostics.liveSupported = false;
        this.notifyDiagnostics();
        resolve(); // Continue with graceful fallback
      };

      ws.onclose = () => {
        this.diagnostics.wsState = "closed";
        this.isLiveTurnActive = false;
        this.suppressIncomingLiveUntilTurnComplete = false;
        this.interrupt("session_closed");
        this.notifyDiagnostics();
        console.log("Live WebSocket closed");
      };
    });
  }

  // Decode and schedule incoming 24kHz model PCM audio with speech rate scaling
  private async handleIncomingAudioChunk(base64Data: string) {
    if (!this.outputAudioCtx) return;

    // Suppress stale chunks arriving after an interrupt
    if (this.suppressIncomingLiveUntilTurnComplete) {
      console.log("[SAM VoiceController] Dropping stale in-flight audio chunk arriving after interrupt");
      return;
    }

    try {
      if (this.outputAudioCtx.state === "suspended") {
        await this.outputAudioCtx.resume();
      }

      // If gemini_live is not currently active, acquire authoritative playback slot.
      // This immediately stops any running browser TTS or neural TTS.
      if (this.activeProvider !== "gemini_live") {
        this.acquirePlaybackSlot("gemini_live");
      }
      this.isLiveTurnActive = true;

      const currentResponseId = this.activeResponseId;

      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Check if chunk has a 44-byte WAV RIFF header
      let pcmBytes = bytes;
      if (bytes.length > 44 && binaryString.startsWith("RIFF")) {
        pcmBytes = bytes.subarray(44);
      }

      const sampleCount = Math.floor(pcmBytes.byteLength / 2);
      const int16Array = new Int16Array(pcmBytes.buffer, pcmBytes.byteOffset, sampleCount);
      const float32Array = new Float32Array(sampleCount);

      for (let i = 0; i < sampleCount; i++) {
        float32Array[i] = int16Array[i] / 32768.0;
      }

      // Create AudioBuffer at 24000Hz
      const audioBuffer = this.outputAudioCtx.createBuffer(1, float32Array.length, 24000);
      audioBuffer.copyToChannel(float32Array, 0);

      const sourceNode = this.outputAudioCtx.createBufferSource();
      sourceNode.buffer = audioBuffer;
      sourceNode.playbackRate.value = this.speechRate;

      // Connect through output analyser so 3D Orb reacts to speech volume
      if (this.outputAnalyser) {
        sourceNode.connect(this.outputAnalyser);
      }

      const now = this.outputAudioCtx.currentTime;
      const startTime = Math.max(now, this.nextPlayTime);
      sourceNode.start(startTime);

      const effectiveDuration = audioBuffer.duration / this.speechRate;
      this.nextPlayTime = startTime + effectiveDuration;

      this.activeSources.push(sourceNode);
      this.diagnostics.activeSourcesCount = this.activeSources.length;
      this.notifyDiagnostics();

      sourceNode.onended = () => {
        // If superseded or interrupted, do nothing
        if (this.activeResponseId !== currentResponseId) return;

        const idx = this.activeSources.indexOf(sourceNode);
        if (idx !== -1) this.activeSources.splice(idx, 1);
        this.diagnostics.activeSourcesCount = this.activeSources.length;

        // Only release playback slot when the server turn is complete AND all scheduled audio has finished playing
        if (this.activeSources.length === 0 && !this.isLiveTurnActive && this.activeProvider === "gemini_live") {
          if (this.outputAudioCtx && this.outputAudioCtx.currentTime >= this.nextPlayTime - 0.05) {
            this.releasePlaybackSlot(currentResponseId, "live_audio_drained");
          }
        }
      };
    } catch (err: any) {
      console.warn("Audio chunk decode error:", err);
      this.diagnostics.lastError = `Decode error: ${err?.message || err}`;
      this.notifyDiagnostics();
    }
  }

  // Play a full standalone WAV audio file (e.g. from /api/tts)
  public async playWavAudio(base64Wav: string): Promise<void> {
    try {
      if (!this.outputAudioCtx) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        this.outputAudioCtx = new AudioCtx({ sampleRate: 24000 });
      }
      if (this.outputAudioCtx.state === "suspended") {
        await this.outputAudioCtx.resume();
      }

      const binary = atob(base64Wav);
      const len = binary.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binary.charCodeAt(i);
      }

      const audioBuffer = await this.outputAudioCtx.decodeAudioData(bytes.buffer);

      // Acquire slot for gemini_tts: cancels any prior playback
      const respId = this.acquirePlaybackSlot("gemini_tts");

      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = this.speechRate;

      if (!this.outputAnalyser) {
        const outAnalyser = this.outputAudioCtx.createAnalyser();
        outAnalyser.fftSize = 256;
        this.outputAnalyser = outAnalyser;
        outAnalyser.connect(this.outputAudioCtx.destination);
      }

      source.connect(this.outputAnalyser);

      return new Promise((resolve) => {
        source.onended = () => {
          const idx = this.activeSources.indexOf(source);
          if (idx !== -1) this.activeSources.splice(idx, 1);
          if (this.activeResponseId === respId) {
            this.releasePlaybackSlot(respId, "tts_ended");
          }
          resolve();
        };

        source.start(0);
        this.activeSources.push(source);
        this.diagnostics.activeSourcesCount = this.activeSources.length;
        this.notifyDiagnostics();
      });
    } catch (err: any) {
      console.warn("playWavAudio error:", err);
      this.diagnostics.lastError = `WAV Playback error: ${err?.message || err}`;
      this.releasePlaybackSlot(this.activeResponseId, "tts_error");
    }
  }

  // Explicit Fallback: Play using browser Web Speech API through the single audio controller
  public speakWithBrowserTTS(text: string, lang: string = "en-IN", rate: number = 1.0): Promise<void> {
    if (typeof window === "undefined" || !window.speechSynthesis) {
      return Promise.resolve();
    }

    // Acquire authoritative slot for browser_tts
    const respId = this.acquirePlaybackSlot("browser_tts");

    return new Promise((resolve) => {
      try {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = Math.max(0.5, Math.min(2.0, rate || this.speechRate));

        if (lang === "te") utterance.lang = "te-IN";
        else if (lang === "hi") utterance.lang = "hi-IN";
        else utterance.lang = "en-IN";

        // Try matching regional voice
        const voices = window.speechSynthesis.getVoices();
        const matchedVoice = voices.find((v) =>
          lang === "te"
            ? v.lang.startsWith("te")
            : lang === "hi"
            ? v.lang.startsWith("hi")
            : v.lang.startsWith("en-IN") || v.lang.startsWith("en")
        );
        if (matchedVoice) utterance.voice = matchedVoice;

        utterance.onend = () => {
          if (this.activeResponseId === respId) {
            this.releasePlaybackSlot(respId, "browser_tts_ended");
          }
          resolve();
        };

        utterance.onerror = (e) => {
          console.warn("Browser TTS utterance error:", e);
          if (this.activeResponseId === respId) {
            this.releasePlaybackSlot(respId, "browser_tts_error");
          }
          resolve();
        };

        window.speechSynthesis.speak(utterance);
      } catch (e: any) {
        console.warn("speakWithBrowserTTS error:", e);
        this.releasePlaybackSlot(respId, "browser_tts_exception");
        resolve();
      }
    });
  }

  // Real-time audio level loop driving 3D Orb and Canvas visualizers
  private startAudioLevelLoop() {
    const dataArray = new Uint8Array(128);

    const update = () => {
      let rms = 0;

      if (this.isSpeaking && this.outputAnalyser) {
        this.outputAnalyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        rms = Math.min(1.0, Math.sqrt(sum / dataArray.length) * 3.5);
      } else if (this.isListening && this.inputAnalyser) {
        this.inputAnalyser.getByteTimeDomainData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          const val = (dataArray[i] - 128) / 128;
          sum += val * val;
        }
        rms = Math.min(1.0, Math.sqrt(sum / dataArray.length) * 4.2);
      }

      this.callbacks.onAudioLevel(rms);
      this.animFrameId = requestAnimationFrame(update);
    };

    this.animFrameId = requestAnimationFrame(update);
  }

  // Barge-In: Immediately interrupt and cancel assistant speaking audio
  public interrupt(reason: string = "user_interrupt") {
    // Invalidate any pending response callbacks or in-flight promises
    this.activeResponseId++;
    this.isLiveTurnActive = false;
    if (reason === "user_interrupt" || reason === "barge_in" || reason === "voice_changed" || reason === "settings_preview") {
      this.suppressIncomingLiveUntilTurnComplete = true;
    }

    for (const source of this.activeSources) {
      try {
        source.onended = null;
        source.stop(0);
        source.disconnect();
      } catch (e) {}
    }
    this.activeSources = [];
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }

    if (typeof window !== "undefined" && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel();
      } catch (e) {}
    }

    this.activeProvider = "none";
    this.isSpeaking = false;
    this.lastAudioStopReason = reason;
    this.diagnostics.activeAudioProvider = "none";
    this.diagnostics.playbackState = "idle";
    this.diagnostics.isWebSpeechSpeaking = false;
    this.diagnostics.lastAudioStopReason = reason;
    this.diagnostics.activeSourcesCount = 0;

    // Send interrupt message to Live session if open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type: "interrupt" }));
      } catch (e) {}
    }

    this.callbacks.onStateChange("interrupted");
    this.notifyDiagnostics();
  }

  // Send a text prompt over the live session
  public sendTextPrompt(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.isLiveSupported) {
      this.ws.send(JSON.stringify({ type: "text", text }));
      this.callbacks.onStateChange("thinking");
    }
  }

  // Reset counters for diagnostics
  public resetDiagnosticsCounters() {
    this.diagnostics.outgoingPackets = 0;
    this.diagnostics.outgoingBytes = 0;
    this.diagnostics.incomingChunks = 0;
    this.diagnostics.incomingBytes = 0;
    this.diagnostics.lastError = null;
    this.notifyDiagnostics();
  }

  // Resume suspended AudioContext (user gesture fix)
  public async resumeAudioContext(): Promise<void> {
    if (this.inputAudioCtx && this.inputAudioCtx.state === "suspended") {
      await this.inputAudioCtx.resume();
    }
    if (this.outputAudioCtx && this.outputAudioCtx.state === "suspended") {
      await this.outputAudioCtx.resume();
    }
    this.notifyDiagnostics();
  }

  // Stop session and release all audio and hardware resources
  public stop() {
    this.isListening = false;
    this.isSpeaking = false;
    this.diagnostics.playbackState = "idle";
    this.diagnostics.micCaptureActive = false;

    this.interrupt();

    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    if (this.processor) {
      try { this.processor.disconnect(); } catch (e) {}
      this.processor = null;
    }

    if (this.muteGain) {
      try { this.muteGain.disconnect(); } catch (e) {}
      this.muteGain = null;
    }

    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }

    if (this.inputAudioCtx) {
      try { this.inputAudioCtx.close(); } catch (e) {}
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      try { this.outputAudioCtx.close(); } catch (e) {}
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }

    this.diagnostics.wsState = "closed";
    this.diagnostics.inputAudioCtxState = "closed";
    this.diagnostics.outputAudioCtxState = "closed";
    this.notifyDiagnostics();

    this.callbacks.onStateChange("idle");
    this.callbacks.onAudioLevel(0);
  }
}
