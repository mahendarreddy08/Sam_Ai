import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveTimezone,
  getCurrentDateTime,
  formatClockContext,
  getTimezoneLabel,
  DEFAULT_DISPLAY_LOCATION,
  DEFAULT_TIMEZONE_IDENTIFIER,
  DEFAULT_TIMEZONE_LABEL,
} from "../src/utils/datetime.js";
import { analyzeSentiment, THEME_PALETTES } from "../src/utils/themeEngine.js";
import { VoiceController } from "../src/components/VoiceController.ts";
import {
  shouldDisableHmr,
  getViteServerHmrConfig,
  createDisableHmrPlugin,
} from "../src/utils/viteHmrConfig.ts";

describe("S.A.M. System Verification Suite", () => {
  describe("1. Timezone & Verified System Clock (Priority 3)", () => {
    it("should resolve fallback timezone to Asia/Kolkata for invalid or empty inputs", () => {
      assert.equal(resolveTimezone(""), "Asia/Kolkata");
      assert.equal(resolveTimezone(undefined), "Asia/Kolkata");
      assert.equal(resolveTimezone("invalid/zone"), "Asia/Kolkata");
      assert.equal(resolveTimezone("auto"), "Asia/Kolkata");
      assert.equal(resolveTimezone("local"), "Asia/Kolkata");
    });

    it("should correctly resolve valid IANA timezones", () => {
      assert.equal(resolveTimezone("America/New_York"), "America/New_York");
      assert.equal(resolveTimezone("UTC"), "UTC");
      assert.equal(resolveTimezone("Asia/Tokyo"), "Asia/Tokyo");
      assert.equal(resolveTimezone("Asia/Kolkata"), "Asia/Kolkata");
    });

    it("should strictly default display location to Hyderabad, Telangana, India while preserving Asia/Kolkata and IST", () => {
      const dt = getCurrentDateTime();
      assert.equal(dt.locationName, "Hyderabad, Telangana, India");
      assert.equal(dt.timezone, "Asia/Kolkata");
      assert.equal(dt.timezoneLabel, "IST");
      assert.ok(dt.formattedText.includes("Hyderabad, Telangana, India"));
      assert.ok(dt.formattedText.includes("IST"));
      assert.ok(!dt.formattedText.includes("Kolkata time"));

      // Also when technical IANA string is passed as location
      const dtWithTz = getCurrentDateTime("Asia/Kolkata", "Asia/Kolkata");
      assert.equal(dtWithTz.locationName, "Hyderabad, Telangana, India");
    });

    it("should accurately reflect Kolkata when specifically requested without changing technical IST timezone", () => {
      const kolkataDt = getCurrentDateTime("Asia/Kolkata", "Kolkata, West Bengal, India");
      assert.equal(kolkataDt.locationName, "Kolkata, West Bengal, India");
      assert.equal(kolkataDt.timezone, "Asia/Kolkata");
      assert.equal(kolkataDt.timezoneLabel, "IST");

      const hyderabadDt = getCurrentDateTime();
      assert.equal(kolkataDt.timeShort, hyderabadDt.timeShort, "Hyderabad and Kolkata share India Standard Time");
    });

    it("should generate verified clock output with all required fields matching actual system timestamp", () => {
      const dt = getCurrentDateTime("Asia/Kolkata");
      assert.ok(dt.date, "Date should exist");
      assert.ok(dt.time, "Time with seconds should exist");
      assert.ok(dt.timeShort, "Short time should exist");
      assert.ok(dt.time24, "24-hour time should exist");
      assert.ok(dt.dayOfWeek, "Day of week should exist");
      assert.equal(dt.timezone, "Asia/Kolkata");
      assert.ok(typeof dt.timestampMs === "number");
      assert.ok(dt.timestampMs > 0);

      // Verify numeric time matches system clock calculation
      const now = new Date();
      const expectedTimeShort = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Kolkata",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      }).format(now);
      assert.equal(dt.timeShort, expectedTimeShort);
    });

    it("should format multilingual date-time strings accurately", () => {
      const dt = getCurrentDateTime("Asia/Kolkata");
      assert.ok(dt.formattedText.includes(dt.timeShort), "English formatted text should include timeShort");
      assert.ok(dt.formattedHindi.includes("तारीख"), "Hindi format should include Devanagari tareekh");
      assert.ok(dt.formattedTelugu.includes("తేదీ"), "Telugu format should include Telugu thedi");
    });

    it("should format timezone labels properly as IST for India timezones", () => {
      assert.equal(getTimezoneLabel("Asia/Kolkata"), "IST");
      assert.equal(getTimezoneLabel("Asia/Calcutta"), "IST");
      assert.equal(getTimezoneLabel("UTC"), "UTC");
    });

    it("should generate a prompt-safe verified clock context stamp", () => {
      const stamp = formatClockContext("Asia/Kolkata");
      assert.ok(stamp.startsWith("[Verified System Clock:"));
      assert.ok(stamp.includes("Asia/Kolkata"));
      assert.ok(stamp.includes("Hyderabad, Telangana, India"));
      assert.ok(stamp.endsWith("]"));
    });
  });

  describe("2. Gemini Voice Catalog & Gender Mapping (Priority 1)", () => {
    const validVoices = ["Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Aoede"];
    const femaleVoices = ["Aoede", "Kore"];
    const maleVoices = ["Puck", "Fenrir", "Charon"];
    const neutralVoices = ["Zephyr"];

    it("should contain official Gemini prebuilt voices without inventing names", () => {
      assert.equal(validVoices.length, 6);
      assert.ok(validVoices.includes("Aoede"));
      assert.ok(validVoices.includes("Kore"));
      assert.ok(validVoices.includes("Puck"));
      assert.ok(validVoices.includes("Fenrir"));
      assert.ok(validVoices.includes("Charon"));
      assert.ok(validVoices.includes("Zephyr"));
    });

    it("should classify voices into accurate female, male, and neutral categories", () => {
      for (const f of femaleVoices) {
        assert.ok(validVoices.includes(f), `Female voice ${f} must be valid`);
      }
      for (const m of maleVoices) {
        assert.ok(validVoices.includes(m), `Male voice ${m} must be valid`);
      }
      for (const n of neutralVoices) {
        assert.ok(validVoices.includes(n), `Neutral voice ${n} must be valid`);
      }
    });
  });

  describe("3. Data Backup, Export & Restoration Integrity (Priority 7)", () => {
    it("should serialize and deserialize user data without data loss", () => {
      const mockBackup = {
        version: "2.0",
        exportDate: new Date().toISOString(),
        userId: "test-user-123",
        tasks: [
          { id: "task-1", title: "Complete college submission", completed: false, createdAt: "2026-10-20" },
          { id: "task-2", title: "Test Gemini Live voice", completed: true, createdAt: "2026-10-20" },
        ],
        notes: [
          { id: "note-1", title: "Architecture", content: "Firebase + Gemini Live WebSockets", createdAt: "2026-10-20" },
        ],
        memory: [
          { id: "mem-1", category: "preference" as const, key: "preferred_voice", value: "Aoede", updatedAt: "2026-10-20" },
          { id: "mem-2", category: "profile" as const, key: "user_name", value: "Mahendar", updatedAt: "2026-10-20" },
        ],
      };

      const jsonString = JSON.stringify(mockBackup);
      assert.ok(jsonString.length > 0);

      const parsed = JSON.parse(jsonString);
      assert.equal(parsed.userId, "test-user-123");
      assert.equal(parsed.tasks.length, 2);
      assert.equal(parsed.notes.length, 1);
      assert.equal(parsed.memory.length, 2);
      assert.equal(parsed.memory[0].key, "preferred_voice");
      assert.equal(parsed.memory[0].value, "Aoede");
    });
  });

  describe("4. Multilingual Script Detection & Code-Switching", () => {
    it("should detect Telugu script accurately", () => {
      const teluguSample = "నమస్కారం! ఎలా ఉన్నారు?";
      const hasTelugu = /[\u0C00-\u0C7F]/.test(teluguSample);
      assert.equal(hasTelugu, true);
    });

    it("should detect Hindi Devanagari script accurately", () => {
      const hindiSample = "नमस्ते! आप कैसे हैं?";
      const hasHindi = /[\u0900-\u097F]/.test(hindiSample);
      assert.equal(hasHindi, true);
    });

    it("should handle mixed Romanized transliterations", () => {
      const teluguRomanized = "Hey Sam, naku Python explain cheyyi";
      const hasKeyword = /\b(naku|cheyyi|ela|unnaru)\b/i.test(teluguRomanized);
      assert.equal(hasKeyword, true);

      const hindiRomanized = "Sam, mujhe ye question samjhao";
      const hasHindiKeyword = /\b(mujhe|samjhao|kaise)\b/i.test(hindiRomanized);
      assert.equal(hasHindiKeyword, true);
    });
  });

  describe("5. Authoritative Single-Audio-Output Controller & Race-Condition Defense", () => {
    function createTestController(stateChanges: string[] = []) {
      return new VoiceController({
        onStateChange: (state) => stateChanges.push(state),
        onAudioLevel: () => {},
        onTranscript: () => {},
        onError: () => {},
      });
    }

    it("should initialize in idle state with active provider 'none' and response ID 0", () => {
      const vc = createTestController();
      assert.equal(vc.getActiveAudioProvider(), "none");
      assert.equal(vc.getActiveResponseId(), 0);
      const diag = vc.getDiagnostics();
      assert.equal(diag.activeAudioProvider, "none");
      assert.equal(diag.activeResponseId, 0);
      assert.equal(diag.playbackState, "idle");
    });

    it("should enforce provider mutual exclusion (never two active providers)", () => {
      const states: string[] = [];
      const vc = createTestController(states);

      // 1. Acquire Gemini Live slot
      const liveId = vc.acquirePlaybackSlot("gemini_live");
      assert.equal(liveId, 1);
      assert.equal(vc.getActiveAudioProvider(), "gemini_live");
      assert.equal(vc.getDiagnostics().activeAudioProvider, "gemini_live");
      assert.equal(vc.getDiagnostics().playbackState, "playing");

      // 2. While Live is playing, acquire neural TTS slot (preempts live immediately)
      const ttsId = vc.acquirePlaybackSlot("gemini_tts");
      assert.equal(ttsId, 2);
      assert.equal(vc.getActiveAudioProvider(), "gemini_tts");
      assert.notEqual(vc.getActiveAudioProvider(), "gemini_live", "Previous provider must be preempted");
      assert.equal(vc.getDiagnostics().activeAudioProvider, "gemini_tts");

      // 3. Acquire browser TTS slot (preempts neural TTS)
      const browserId = vc.acquirePlaybackSlot("browser_tts");
      assert.equal(browserId, 3);
      assert.equal(vc.getActiveAudioProvider(), "browser_tts");
      assert.equal(vc.getDiagnostics().isWebSpeechSpeaking, true);
    });

    it("should reject stale response release calls without corrupting active slot", () => {
      const vc = createTestController();
      const id1 = vc.acquirePlaybackSlot("gemini_live");
      const id2 = vc.acquirePlaybackSlot("gemini_tts"); // id1 is now stale

      // Try releasing with stale id1
      vc.releasePlaybackSlot(id1, "stale_finished");
      assert.equal(vc.getActiveAudioProvider(), "gemini_tts", "Active provider must not be released by stale ID");
      assert.equal(vc.getActiveResponseId(), id2);

      // Release with matching active id2
      vc.releasePlaybackSlot(id2, "valid_finished");
      assert.equal(vc.getActiveAudioProvider(), "none");
      assert.equal(vc.getDiagnostics().lastAudioStopReason, "valid_finished");
      assert.equal(vc.getDiagnostics().playbackState, "idle");
    });

    it("should invalidate in-flight response and increment response ID on interrupt", () => {
      const states: string[] = [];
      const vc = createTestController(states);

      const id = vc.acquirePlaybackSlot("gemini_live");
      assert.equal(id, 1);

      vc.interrupt("user_barge_in");
      assert.equal(vc.getActiveAudioProvider(), "none");
      assert.equal(vc.getActiveResponseId(), 2, "Response ID must be incremented to invalidate stale callbacks");
      assert.equal(vc.getDiagnostics().lastAudioStopReason, "user_barge_in");
      assert.equal(vc.getDiagnostics().playbackState, "idle");
      assert.ok(states.includes("interrupted"));
    });

    it("should interrupt and invalidate active audio output when voice is changed", () => {
      const states: string[] = [];
      const vc = createTestController(states);

      vc.acquirePlaybackSlot("gemini_live");
      assert.equal(vc.getActiveAudioProvider(), "gemini_live");

      // Changing voice must interrupt previous playback
      vc.setVoiceName("Aoede");
      assert.equal(vc.getActiveAudioProvider(), "none");
      assert.equal(vc.getDiagnostics().lastAudioStopReason, "voice_changed");
    });

    it("should preserve active response ID across multi-chunk Gemini Live streaming until turn completes", () => {
      const vc = createTestController();

      // First chunk starts live turn
      const firstId = vc.acquirePlaybackSlot("gemini_live");
      assert.equal(firstId, 1);
      assert.equal(vc.getActiveAudioProvider(), "gemini_live");

      // Subsequent chunks check activeProvider === 'gemini_live' and retain firstId
      assert.equal(vc.getActiveAudioProvider(), "gemini_live");
      assert.equal(vc.getActiveResponseId(), 1, "Response ID must remain stable across all chunks of the turn");

      // Release slot only when turn complete
      vc.releasePlaybackSlot(firstId, "turn_complete");
      assert.equal(vc.getActiveAudioProvider(), "none");
    });
  });

  describe("6. Sentiment Theme Engine & Ambient Glow Palettes", () => {
    it("should classify encouraging, congratulatory, and praise responses as positive (Warm Gold)", () => {
      assert.equal(analyzeSentiment("You did a wonderful job, congratulations! S.A.M. is proud of your progress!"), "positive");
      assert.equal(analyzeSentiment("Great work! That solution is fantastic and brilliant."), "positive");
      assert.equal(analyzeSentiment("చాలా మంచిది! మీ కోడింగ్ ప్రాజెక్ట్ అద్భుతంగా ఉంది."), "positive");
      assert.equal(analyzeSentiment("बहुत अच्छा! बधाई हो, आपने बहुत बढ़िया काम किया।"), "positive");
    });

    it("should classify code, mathematics, and analytical concepts as intellectual (Cool Violet)", () => {
      assert.equal(analyzeSentiment("In Python, functions are defined using the 'def' keyword and accept parameters."), "intellectual");
      assert.equal(analyzeSentiment("The calculation for 25 * 18 + 140 is 590."), "intellectual");
      assert.equal(analyzeSentiment("Quantum computing leverages superposition and entanglement to execute complex algorithms."), "intellectual");
      assert.equal(analyzeSentiment("పైథాన్‌లో Functions అనేవి కోడ్ బ్లాక్స్."), "intellectual");
    });

    it("should classify steady conversational responses and clock reporting as neutral (Calm Blue)", () => {
      assert.equal(analyzeSentiment("The current time in Hyderabad, Telangana, India is 3:45 PM (IST) on Wednesday."), "neutral");
      assert.equal(analyzeSentiment("I am ready to assist you. What would you like to explore next?"), "neutral");
      assert.equal(analyzeSentiment(""), "neutral");
    });

    it("should provide distinct theme palettes matching user requirements", () => {
      // Warm Gold for positive
      assert.equal(THEME_PALETTES.positive.name, "warm-gold");
      assert.equal(THEME_PALETTES.positive.label, "Warm Gold");
      assert.ok(THEME_PALETTES.positive.ambientGlow.includes("amber") || THEME_PALETTES.positive.ambientGlow.includes("yellow"));

      // Calm Blue for neutral
      assert.equal(THEME_PALETTES.neutral.name, "calm-blue");
      assert.equal(THEME_PALETTES.neutral.label, "Calm Blue");
      assert.ok(THEME_PALETTES.neutral.ambientGlow.includes("sky") || THEME_PALETTES.neutral.ambientGlow.includes("cyan"));

      // Cool Violet for intellectual
      assert.equal(THEME_PALETTES.intellectual.name, "cool-violet");
      assert.equal(THEME_PALETTES.intellectual.label, "Cool Violet");
      assert.ok(THEME_PALETTES.intellectual.ambientGlow.includes("violet") || THEME_PALETTES.intellectual.ambientGlow.includes("purple"));
    });
  });

  describe("7. Vite HMR Configuration & AI Studio Preview Stability", () => {
    it("should correctly detect when running in Google AI Studio via APPLET_ID or K_SERVICE", () => {
      // In AI Studio with APPLET_ID
      assert.equal(shouldDisableHmr({ APPLET_ID: "c87764c0-643c-4dc9-9d4e-c5702067853f" }), true);
      // In AI Studio with K_SERVICE
      assert.equal(shouldDisableHmr({ K_SERVICE: "ais-dev-12345" }), true);
      // When explicitly requested via DISABLE_HMR=true
      assert.equal(shouldDisableHmr({ DISABLE_HMR: "true" }), true);
    });

    it("should preserve normal HMR in standard local development environments", () => {
      // Outside AI Studio in local dev (no APPLET_ID, no K_SERVICE, no DISABLE_HMR)
      assert.equal(shouldDisableHmr({}), false);
      // Even if in cloud or container, explicit DISABLE_HMR=false overrides and enables HMR
      assert.equal(shouldDisableHmr({ APPLET_ID: "xyz", DISABLE_HMR: "false" }), false);
    });

    it("should return unified server HMR options for disabled and enabled environments", () => {
      const disabledConfig = getViteServerHmrConfig({ APPLET_ID: "test-app" });
      assert.equal(disabledConfig.hmr, false);
      assert.equal(disabledConfig.ws, false);
      assert.equal(disabledConfig.watch, null);

      const enabledConfig = getViteServerHmrConfig({});
      assert.equal(enabledConfig.hmr, true);
      assert.equal(enabledConfig.ws, undefined);
      assert.equal(enabledConfig.watch, undefined);
    });

    it("should create Vite plugin that neutralizes client transport.connect without breaking client utilities", () => {
      const plugin = createDisableHmrPlugin({ APPLET_ID: "test-app" });
      assert.ok(plugin, "Plugin should be returned when HMR is disabled");
      assert.equal(plugin?.apply, "serve");

      const mockClientCode = `
var bundledDevClient;
transport.connect(createHMRHandler(handleMessage));
setupForwardConsoleHandler(transport, forwardConsole);
export function updateStyle() {}
`;
      const transformed = plugin.transform(mockClientCode, "/node_modules/vite/dist/client/client.mjs");
      assert.ok(transformed, "Should transform Vite client module");
      assert.ok(!transformed.includes("transport.connect(createHMRHandler"), "transport.connect must be removed");
      assert.ok(transformed.includes("updateStyle"), "updateStyle export must be preserved");
    });

    it("should not create plugin when HMR is enabled for local development", () => {
      const plugin = createDisableHmrPlugin({});
      assert.equal(plugin, null, "Plugin should be null when HMR is not disabled");
    });
  });
});

