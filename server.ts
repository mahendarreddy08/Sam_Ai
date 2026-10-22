import express from "express";
import http from "http";
import path from "path";
import dotenv from "dotenv";
import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from "@google/genai";
import { fileURLToPath } from "url";
import { getCurrentDateTime, resolveTimezone, formatClockContext } from "./src/utils/datetime.js";
import { RagKnowledgeBase, generateDeterministicEmbedding } from "./src/services/ragService.js";
import { executeSafeAction, isDomainWhitelisted, sanitizeUrl, APPROVED_DOMAINS } from "./src/services/actionRegistry.js";
import { resolveWebsiteDestination, launchWebsite, WEBSITE_REGISTRY } from "./src/services/websiteLauncher.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);

app.use(express.json({ limit: "10mb" }));

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";

const ai = new GoogleGenAI({
  apiKey: GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// Initialize real RAG Knowledge Base with gemini-embedding-2-preview and fallback
const ragKnowledgeBase = new RagKnowledgeBase(async (text: string) => {
  if (!GEMINI_API_KEY) {
    return generateDeterministicEmbedding(text);
  }
  try {
    const embedRes = await ai.models.embedContent({
      model: "gemini-embedding-2-preview",
      contents: text,
    });
    const values = (embedRes as any).embedding?.values || (embedRes as any).embeddings?.[0]?.values;
    if (values && Array.isArray(values) && values.length > 0) {
      return values;
    }
  } catch (err: any) {
    console.warn("[RAG] embedContent warning, falling back to deterministic embedding:", err?.message || err);
  }
  return generateDeterministicEmbedding(text);
});

// Tool Declarations for Gemini Function Calling
const toolsDeclarations: FunctionDeclaration[] = [
  {
    name: "get_current_datetime",
    description: "Get the current verified real-time date, exact time, day of the week, display location, and timezone from the system clock. Call this whenever the user asks for the current time, date, day, or clock in any language (English, Hindi, Telugu).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "Optional city or location name requested by user (e.g. 'Hyderabad', 'Kolkata', 'New York'). Defaults to 'Hyderabad, Telangana, India'.",
        },
        timezone: {
          type: Type.STRING,
          description: "Optional IANA timezone name (e.g. 'Asia/Kolkata', 'America/New_York', 'UTC'). Defaults to user's detected local timezone.",
        },
      },
    },
  },
  {
    name: "getCurrentDateTime",
    description: "Alias for get_current_datetime. Get the verified current date, time, day of the week, display location, and timezone.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "Optional city or location name requested by user (e.g. 'Hyderabad', 'Kolkata'). Defaults to 'Hyderabad, Telangana, India'.",
        },
        timezone: {
          type: Type.STRING,
          description: "Optional IANA timezone name (e.g. 'Asia/Kolkata').",
        },
      },
    },
  },
  {
    name: "getWeather",
    description: "Get real-time weather conditions, temperature, humidity, and forecast for any city worldwide using Open-Meteo.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: {
          type: Type.STRING,
          description: "City or location name (e.g., 'Hyderabad', 'Delhi', 'Tokyo', 'San Francisco', 'London').",
        },
      },
      required: ["location"],
    },
  },
  {
    name: "manageNote",
    description: "Create, view, or delete a persistent personal note.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "Action to perform: 'create', 'list', or 'delete'.",
        },
        title: {
          type: Type.STRING,
          description: "Title of the note (for create).",
        },
        content: {
          type: Type.STRING,
          description: "Body text or content of the note (for create).",
        },
        id: {
          type: Type.STRING,
          description: "ID of the note to delete.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "manageTask",
    description: "Create, view, complete, or delete a task item on the user's personal task list.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "Action to perform: 'create', 'list', 'complete', or 'delete'.",
        },
        title: {
          type: Type.STRING,
          description: "Title of the task to create or complete.",
        },
        id: {
          type: Type.STRING,
          description: "ID of the task to complete or delete.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "setTimer",
    description: "Set an active countdown timer with a specific duration in seconds.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        durationSeconds: {
          type: Type.NUMBER,
          description: "Duration of the timer in seconds (e.g., 60 for 1 minute, 300 for 5 minutes).",
        },
        label: {
          type: Type.STRING,
          description: "Optional label for the timer (e.g. 'Tea', 'Coding Sprint', 'Meditation').",
        },
      },
      required: ["durationSeconds"],
    },
  },
  {
    name: "setReminder",
    description: "Create a reminder for a specific upcoming topic or event.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        message: {
          type: Type.STRING,
          description: "The reminder message or alert.",
        },
        timeDescription: {
          type: Type.STRING,
          description: "When to remind the user (e.g., 'in 15 minutes', 'at 4 PM').",
        },
      },
      required: ["message"],
    },
  },
  {
    name: "calculate",
    description: "Perform precise arithmetic, mathematical calculations, percentages, or algebraic problem solving.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        expression: {
          type: Type.STRING,
          description: "The mathematical expression to evaluate (e.g., '45 * 12', '1250 / 5', '2^8', 'sqrt(144)').",
        },
      },
      required: ["expression"],
    },
  },
  {
    name: "manageMemory",
    description: "Save, update, or recall persistent user preferences, goals, background, user name, or ongoing projects.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: {
          type: Type.STRING,
          description: "Action to perform: 'save', 'list', or 'delete'.",
        },
        key: {
          type: Type.STRING,
          description: "Concise identifier (e.g. 'user_name', 'primary_goal', 'preferred_language', 'active_project').",
        },
        value: {
          type: Type.STRING,
          description: "The fact, preference, or project details to commit to long-term memory.",
        },
        category: {
          type: Type.STRING,
          description: "Category: 'preference', 'profile', 'project', or 'fact'.",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "changeLanguage",
    description: "Switch the active language mode of S.A.M. ('auto', 'en', 'hi', or 'te').",
    parameters: {
      type: Type.OBJECT,
      properties: {
        language: {
          type: Type.STRING,
          description: "Target language mode: 'auto', 'en' (English), 'hi' (Hindi), or 'te' (Telugu).",
        },
      },
      required: ["language"],
    },
  },
  {
    name: "getDailyTechBriefing",
    description: "Get the latest verified tech news, AI developments, and headlines with source URLs and freshness metadata.",
    parameters: {
      type: Type.OBJECT,
      properties: {},
    },
  },
  {
    name: "open_website",
    description: "Open an approved external website URL in the user's browser. URL must belong to the approved domain whitelist.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: {
          type: Type.STRING,
          description: "The full destination web URL to open (e.g., 'https://github.com', 'https://en.wikipedia.org').",
        },
      },
      required: ["url"],
    },
  },
  {
    name: "search_google",
    description: "Search Google for a query and present verified search results page to the user.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "The search query string (e.g. 'Python tutorials', 'Machine learning roadmap').",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "open_youtube",
    description: "Open YouTube homepage or search YouTube for specific videos/tutorials.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: {
          type: Type.STRING,
          description: "Optional search query to search on YouTube (e.g., 'Python full course', 'lofi beats').",
        },
      },
    },
  },
  {
    name: "open_social_site",
    description: "Open an explicitly supported social website (Instagram, Facebook, LinkedIn, GitHub, Reddit, Twitter/X).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        site: {
          type: Type.STRING,
          description: "Supported social platform name: 'instagram', 'facebook', 'github', 'linkedin', 'reddit', 'twitter', or 'x'.",
        },
      },
      required: ["site"],
    },
  },
  {
    name: "launch_website",
    description: "Launch one of the 12 verified website destinations in the user's browser: 'youtube', 'instagram', 'facebook', 'whatsapp', 'linkedin', 'x', 'telegram', 'gmail', 'googledrive', 'github', 'chatgpt', or 'googlesearch'.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        destination: {
          type: Type.STRING,
          description: "Target site identifier: 'youtube', 'instagram', 'facebook', 'whatsapp', 'linkedin', 'x', 'telegram', 'gmail', 'googledrive', 'github', 'chatgpt', or 'googlesearch'.",
        },
      },
      required: ["destination"],
    },
  },
];

// Safe math evaluation
function safeCalculate(expression: string): { expression: string; result: string; explanation: string } {
  try {
    let sanitized = expression.replace(/sqrt\(([^)]+)\)/gi, "Math.sqrt($1)");
    sanitized = sanitized.replace(/\^/g, "**");
    sanitized = sanitized.replace(/[^0-9+\-*/().%*Math.sqrt\s]/g, "");
    if (!sanitized.trim()) {
      return { expression, result: "Error", explanation: "Invalid mathematical expression" };
    }
    // eslint-disable-next-line no-new-func
    const val = Function(`"use strict"; return (${sanitized})`)();
    if (typeof val !== "number" || !isFinite(val)) {
      return { expression, result: "Error", explanation: "Calculation yielded undefined or infinite result" };
    }
    const formatted = Number.isInteger(val) ? val.toString() : val.toFixed(4).replace(/\.?0+$/, "");
    return {
      expression,
      result: formatted,
      explanation: `${expression} = ${formatted}`,
    };
  } catch (err: any) {
    return { expression, result: "Error", explanation: err?.message || "Computation error" };
  }
}

// Weather helper using Open-Meteo
async function fetchWeather(location: string) {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(location)}&count=1&language=en&format=json`
    );
    const geoData: any = await geoRes.json();
    if (!geoData.results || geoData.results.length === 0) {
      return { error: `Could not find location "${location}". Please specify city name.` };
    }
    const place = geoData.results[0];
    const { latitude, longitude, name, country, admin1 } = place;

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    const weatherData: any = await weatherRes.json();
    const current = weatherData.current;

    const codeMap: Record<number, string> = {
      0: "Clear sky",
      1: "Mainly clear",
      2: "Partly cloudy",
      3: "Overcast",
      45: "Fog",
      48: "Depositing rime fog",
      51: "Light drizzle",
      53: "Moderate drizzle",
      55: "Dense drizzle",
      61: "Slight rain",
      63: "Moderate rain",
      65: "Heavy rain",
      71: "Slight snow fall",
      73: "Moderate snow fall",
      75: "Heavy snow fall",
      80: "Slight rain showers",
      81: "Moderate rain showers",
      82: "Violent rain showers",
      95: "Thunderstorm",
    };

    const condition = codeMap[current.weather_code] || "Partly cloudy";

    return {
      location: `${name}${admin1 ? `, ${admin1}` : ""}, ${country || ""}`,
      temperatureC: Math.round(current.temperature_2m),
      temperatureF: Math.round((current.temperature_2m * 9) / 5 + 32),
      feelsLikeC: Math.round(current.apparent_temperature),
      feelsLikeF: Math.round((current.apparent_temperature * 9) / 5 + 32),
      condition,
      humidity: current.relative_humidity_2m,
      windSpeedKmh: Math.round(current.wind_speed_10m),
      maxTempC: weatherData.daily?.temperature_2m_max?.[0],
      minTempC: weatherData.daily?.temperature_2m_min?.[0],
      retrievedAt: new Date().toISOString(),
      source: "Open-Meteo Real-Time Global Forecast API",
    };
  } catch (err: any) {
    return { error: `Weather service error: ${err?.message || "network failure"}` };
  }
}

// Priority 4 & 5: Daily Tech & Knowledge Briefing with Automatic Refresh
interface TechNewsItem {
  id: number;
  title: string;
  url: string;
  score: number;
  by: string;
  retrievedAt: string;
  source: string;
}

interface DailyBriefingCache {
  status: "idle" | "success" | "error";
  lastSuccessfulRefresh: string | null;
  refreshCount: number;
  durationMs: number;
  items: TechNewsItem[];
  error?: string;
}

let dailyBriefing: DailyBriefingCache = {
  status: "idle",
  lastSuccessfulRefresh: null,
  refreshCount: 0,
  durationMs: 0,
  items: [],
};

async function executeDailyRefresh(): Promise<DailyBriefingCache> {
  const startTime = Date.now();
  console.log("[DailyRefresh] Running automated data refresh...");
  try {
    const topRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    if (!topRes.ok) throw new Error(`HackerNews API returned ${topRes.status}`);
    const storyIds: number[] = await topRes.json();
    const targetIds = storyIds.slice(0, 6);

    const stories = await Promise.all(
      targetIds.map(async (id) => {
        try {
          const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${id}.json`);
          if (!itemRes.ok) return null;
          const data: any = await itemRes.json();
          if (!data || !data.title) return null;
          return {
            id: data.id,
            title: data.title,
            url: data.url || `https://news.ycombinator.com/item?id=${data.id}`,
            score: data.score || 0,
            by: data.by || "anonymous",
            retrievedAt: new Date().toISOString(),
            source: "Hacker News Top Stories",
          };
        } catch {
          return null;
        }
      })
    );

    const valid = stories.filter(Boolean) as TechNewsItem[];
    if (valid.length === 0) {
      throw new Error("No stories could be fetched from upstream service");
    }

    dailyBriefing = {
      status: "success",
      lastSuccessfulRefresh: new Date().toISOString(),
      refreshCount: dailyBriefing.refreshCount + 1,
      durationMs: Date.now() - startTime,
      items: valid,
    };
    console.log(`[DailyRefresh] Success: Cached ${valid.length} items in ${dailyBriefing.durationMs}ms`);
    return dailyBriefing;
  } catch (err: any) {
    dailyBriefing = {
      ...dailyBriefing,
      status: "error",
      durationMs: Date.now() - startTime,
      error: err?.message || "Refresh failed",
    };
    console.error("[DailyRefresh] Failure:", err?.message || err);
    return dailyBriefing;
  }
}

// REST Endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    hasApiKey: !!GEMINI_API_KEY,
    models: {
      live: "gemini-3.8-live",
      chat: "gemini-3.8-flash",
      tts: "gemini-3.8-flash-lite-tts",
    },
    languages: ["en", "hi", "te"],
    version: "3.1.0",
    firebaseConfigured: true,
  });
});

app.get("/api/weather", async (req, res) => {
  const loc = (req.query.location as string) || "Hyderabad";
  const data = await fetchWeather(loc);
  res.json(data);
});

app.get("/api/datetime", (req, res) => {
  const tz = (req.query.timezone as string) || "Asia/Kolkata";
  const loc = (req.query.location as string) || undefined;
  const dt = getCurrentDateTime(tz, loc);
  res.json(dt);
});

app.get("/api/briefing", async (req, res) => {
  if (dailyBriefing.items.length === 0) {
    await executeDailyRefresh();
  }
  res.json(dailyBriefing);
});

// Secure Cloud Scheduler / Cron endpoint (Priority 5)
app.post("/api/cron/daily-refresh", async (req, res) => {
  const authHeader = req.headers.authorization || req.headers["x-scheduler-secret"];
  const expectedSecret = process.env.CRON_SECRET || "sam-scheduler-2026";
  if (process.env.NODE_ENV === "production" && authHeader !== `Bearer ${expectedSecret}` && authHeader !== expectedSecret) {
    return res.status(401).json({ error: "Unauthorized scheduled invocation" });
  }

  const result = await executeDailyRefresh();
  res.json({
    message: "Scheduled refresh completed successfully",
    ...result,
  });
});

// Manual test/diagnostic trigger endpoint
app.post("/api/refresh/trigger", async (req, res) => {
  const result = await executeDailyRefresh();
  res.json(result);
});

// Rate limit cooldown timestamp
let quotaCooldownUntil = 0;

// High-speed smart local assistant engine (provides seamless responses during API quota limits or offline)
async function handleSmartLocalAssistant(message: string, clientState: any = {}) {
  const lower = message.toLowerCase().trim();
  let reply = "I am S.A.M., ready to assist you. What can I do for you?";
  let toolAction: any = null;
  let detectedLang: "en" | "hi" | "te" = "en";

  // Check language hints
  const hasTeluguChars = /[\u0C00-\u0C7F]/.test(message);
  const hasHindiChars = /[\u0900-\u097F]/.test(message);
  const hasTeluguKeywords = /\b(naku|cheyyi|rayi|pettu|entha|ela|unnaru|unnav|namaskaram|telugu|kavali|cheppandi)\b/i.test(lower);
  const hasHindiKeywords = /\b(mujhe|samjhao|kya|hai|batao|karo|kaise|namaste|hindi|chahiye|samay)\b/i.test(lower);

  if (hasTeluguChars || hasTeluguKeywords) detectedLang = "te";
  else if (hasHindiChars || hasHindiKeywords) detectedLang = "hi";

  // 1. Math and Arithmetic Calculation
  const mathMatch = message.match(/(?:calculate|what is|compute|solve)?\s*([0-9\s.+\-*/()%^]+(?:\s*[+\-*/^%]\s*[0-9]+)+)/i);
  if (mathMatch && mathMatch[1]) {
    const calc = safeCalculate(mathMatch[1]);
    if (calc.result !== "Error") {
      if (detectedLang === "te") {
        reply = `${calc.expression} యొక్క లెక్కింపు ఫలితం ${calc.result}.`;
      } else if (detectedLang === "hi") {
        reply = `${calc.expression} का परिणाम ${calc.result} है।`;
      } else {
        reply = `The calculation for ${calc.expression} is ${calc.result}.`;
      }
      toolAction = { type: "calculation", expression: calc.expression, result: calc.result, explanation: calc.explanation };
      return { reply, toolAction, detectedLang };
    }
  }

  // 2. Python / Programming Explanations (multilingual)
  if (
    lower.includes("python") &&
    (lower.includes("function") || lower.includes("explain") || lower.includes("cheyyi") || lower.includes("samjhao"))
  ) {
    if (detectedLang === "te" || lower.includes("cheyyi") || lower.includes("naku")) {
      reply =
        "పైథాన్‌లో Functions అనేవి నిర్దిష్టమైన పనిని పదే పదే చేయడానికి ఉపయోగించే కోడ్ బ్లాక్స్. ఉదాహరణకు: def greet(name): return f'Hello, {name}!'. దీనిని greet('Mahendar') అని కాల్ చేస్తే ఫలితం వస్తుంది. Functions కోడ్‌ని ఆర్గనైజ్ చేయడానికి మరియు తిరిగి ఉపయోగించడానికి చాలా ఉపయోగపడతాయి.";
    } else if (detectedLang === "hi" || lower.includes("samjhao")) {
      reply =
        "पायथन में Functions ऐसे कोड ब्लॉक्स होते हैं जो किसी विशिष्ट कार्य को बार-बार करने के लिए बनाए जाते हैं। उदाहरण: def add(a, b): return a + b. यह आपके कोड को व्यवस्थित और पुन: प्रयोज्य बनाता है।";
    } else {
      reply =
        "In Python, functions are reusable blocks of code defined with the 'def' keyword. For example: def greet(name): return f'Hello, {name}!'. They accept parameters, return outputs, and make your code modular and readable.";
    }
    return { reply, toolAction: null, detectedLang };
  }

  // 3. Time & Date queries (multilingual: English, Hindi, Telugu)
  const isTimeOrDateQuery =
    /\b(time|clock|date|today'?s date|current time|what time|what day|day of week)\b/i.test(lower) ||
    /(?:समय|तारीख|घड़ी|दिन|वक्त|कितने बजे|क्या समय|आज का दिन|आज की तारीख)/.test(message) ||
    /\b(samay|samaya|tarikh|tareekh|kitne baje|kya samay|aaj ka din|waqt)\b/i.test(lower) ||
    /(?:సమయం|తేదీ|గడియారం|ఈ రోజు|ఏ వారం|ఎంత సమయం|ఇప్పుడు సమయం)/.test(message) ||
    /\b(samayam|samayam entha|ippudu samayam|ee roju|thedi|roju entha|e varam)\b/i.test(lower);

  if (isTimeOrDateQuery) {
    let targetLocation = clientState?.location || clientState?.profile?.location || "Hyderabad, Telangana, India";
    let targetTz = clientState?.timezone || "Asia/Kolkata";

    // Honor specific cities if asked explicitly
    if (/\b(kolkata|calcutta)\b/i.test(lower) || /कोलकाता/.test(message) || /కోల్‌కతా/.test(message)) {
      targetLocation = "Kolkata, West Bengal, India";
      targetTz = "Asia/Kolkata";
    } else if (/\b(delhi|new delhi)\b/i.test(lower) || /दिल्ली/.test(message) || /ఢిల్లీ/.test(message)) {
      targetLocation = "New Delhi, India";
      targetTz = "Asia/Kolkata";
    } else if (/\b(mumbai|bombay)\b/i.test(lower) || /मुंबई/.test(message) || /ముంబై/.test(message)) {
      targetLocation = "Mumbai, Maharashtra, India";
      targetTz = "Asia/Kolkata";
    } else if (/\b(bengaluru|bangalore)\b/i.test(lower) || /बैंगलोर|बेंगलुरु/.test(message) || /బెంగళూరు/.test(message)) {
      targetLocation = "Bengaluru, Karnataka, India";
      targetTz = "Asia/Kolkata";
    } else if (/\b(hyderabad)\b/i.test(lower) || /हैदराबाद/.test(message) || /హైదరాబాద్/.test(message)) {
      targetLocation = "Hyderabad, Telangana, India";
      targetTz = "Asia/Kolkata";
    }

    const tz = resolveTimezone(targetTz);
    try {
      const dt = getCurrentDateTime(tz, targetLocation);
      if (detectedLang === "te") {
        reply = dt.formattedTelugu;
      } else if (detectedLang === "hi") {
        reply = dt.formattedHindi;
      } else {
        reply = dt.formattedText;
      }
      toolAction = {
        type: "time",
        data: dt,
      };
      return { reply, toolAction, detectedLang };
    } catch (err: any) {
      reply = "Unable to retrieve the system clock at this moment.";
      return { reply, toolAction: null, detectedLang };
    }
  }

  // 4. Weather queries (multilingual)
  if (
    lower.includes("weather") ||
    lower.includes("forecast") ||
    lower.includes("temperature") ||
    lower.includes("mausam") ||
    lower.includes("varsham") ||
    lower.includes("rain")
  ) {
    let targetCity = "Hyderabad";
    const commonCities = [
      "hyderabad", "delhi", "new delhi", "mumbai", "bengaluru", "bangalore",
      "chennai", "kolkata", "vijayawada", "visakhapatnam", "vizag", "warangal",
      "pune", "ahmedabad", "jaipur", "tokyo", "london", "paris", "san francisco", "new york"
    ];
    let found = false;
    for (const c of commonCities) {
      if (lower.includes(c)) {
        targetCity = c.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        found = true;
        break;
      }
    }
    if (!found) {
      const cityBefore = message.match(/([A-Za-z]+)\s+(?:lo|me)\s+(?:weather|mausam|varsham)/i);
      if (cityBefore && cityBefore[1]) {
        targetCity = cityBefore[1];
      } else {
        const inMatch = message.match(/(?:weather|temperature|forecast|mausam)(?:\s+(?:in|for|at|of))?\s+([A-Za-z\s]+)/i);
        if (inMatch && inMatch[1]) {
          const candidate = inMatch[1].replace(/\b(?:today|tomorrow|right now|currently|please|lo|me|ela|undi|kaisa|hai)\b/gi, "").trim();
          if (candidate.length > 2) targetCity = candidate;
        }
      }
    }
    const weather = await fetchWeather(targetCity);
    if (!weather.error) {
      if (detectedLang === "te") {
        reply = `${weather.location} లో ఉష్ణోగ్రత ${weather.temperatureC}°C (${weather.condition}). గాలి వేగం ${weather.windSpeedKmh} km/h.`;
      } else if (detectedLang === "hi") {
        reply = `${weather.location} में तापमान ${weather.temperatureC}°C (${weather.condition}) है और हवा की गति ${weather.windSpeedKmh} km/h है।`;
      } else {
        reply = `In ${weather.location}, it's ${weather.temperatureC}°C (${weather.temperatureF}°F) and ${weather.condition}. Wind speed is ${weather.windSpeedKmh} km/h.`;
      }
    } else {
      reply = `Weather check: ${weather.error}`;
    }
    toolAction = { type: "weather", data: weather };
    return { reply, toolAction, detectedLang };
  }

  // 5. Task management (multilingual)
  if (
    lower.includes("task") ||
    lower.includes("todo") ||
    lower.includes("jodo") ||
    lower.includes("add cheyyi")
  ) {
    const cleanTitle =
      message.replace(/^(?:hey\s+sam[,.]?\s*)?(?:add\s+task:?|new\s+task:?|task:?|task add cheyyi:?|task jodo:?)\s*/i, "").trim() ||
      "New Task";
    if (detectedLang === "te") {
      reply = `నేను "${cleanTitle}" అనే టాస్క్‌ను మీ లిస్ట్‌లో చేర్చాను.`;
    } else if (detectedLang === "hi") {
      reply = `मैंने आपकी कार्य सूची में "${cleanTitle}" जोड़ दिया है।`;
    } else {
      reply = `I've added "${cleanTitle}" to your task list.`;
    }
    toolAction = { type: "task", action: "create", title: cleanTitle };
    return { reply, toolAction, detectedLang };
  }

  // 6. Note taking (multilingual)
  if (
    lower.includes("note") ||
    lower.includes("write down") ||
    lower.includes("note rayi") ||
    lower.includes("note likho")
  ) {
    const cleanContent =
      message.replace(/^(?:hey\s+sam[,.]?\s*)?(?:take\s+a\s+note:?|write\s+down:?|save\s+note:?|note:?|note rayi:?|note likho:?)\s*/i, "").trim() ||
      "Saved Note";
    if (detectedLang === "te") {
      reply = "నేను మీ నోట్‌ను భద్రపరిచాను.";
    } else if (detectedLang === "hi") {
      reply = "मैंने आपका नोट सहेज लिया है।";
    } else {
      reply = "I've noted that down for you.";
    }
    toolAction = { type: "note", action: "create", title: "Quick Note", content: cleanContent };
    return { reply, toolAction, detectedLang };
  }

  // 7. Timer management (multilingual)
  if (lower.includes("timer") || lower.includes("countdown") || lower.includes("alarm") || lower.includes("pettu") || lower.includes("lagao")) {
    const numMatch = message.match(/(\d+)\s*(?:minute|min|sec|second|nimishalu|minute)?s?/i);
    let seconds = 300;
    let label = "Timer";
    if (numMatch) {
      const val = parseInt(numMatch[1], 10);
      if (lower.includes("sec")) {
        seconds = val;
        label = `${val}s Timer`;
      } else {
        seconds = val * 60;
        label = `${val}m Timer`;
      }
    }
    if (detectedLang === "te") {
      reply = `నేను మీ కోసం ${Math.round(seconds / 60)} నిమిషాల టైమర్‌ను సెట్ చేసాను.`;
    } else if (detectedLang === "hi") {
      reply = `मैंने आपके लिए ${Math.round(seconds / 60)} मिनट का टाइमर लगा दिया है।`;
    } else {
      reply = `Setting a ${Math.round(seconds / 60)} minute timer for you now.`;
    }
    toolAction = { type: "timer", durationSeconds: seconds, label };
    return { reply, toolAction, detectedLang };
  }

  // 8. Coding & Debugging handler
  if (
    lower.includes("debug") ||
    lower.includes("syntax error") ||
    lower.includes("bug in") ||
    (lower.includes("code") && (lower.includes("fix") || lower.includes("error") || lower.includes("help")))
  ) {
    if (lower.includes("def") && !lower.includes(":")) {
      reply = "In your Python code, a colon is missing after the parameter list. Change 'def add(a, b)' to 'def add(a, b):' and indent the next line 'return a + b'.";
    } else if (detectedLang === "te") {
      reply = "మీ కోడ్‌ని పరిశీలిద్దాం. పైథాన్‌లో ఇండెంటేషన్ (indentation), ఫంక్షన్ నిర్వచనం చివర కోలన్ (:), లేదా వేరియబుల్ పేర్ల స్పెల్లింగ్ సరిచూసుకోండి.";
    } else if (detectedLang === "hi") {
      reply = "आइए आपके कोड की जाँच करें। पायथन में इंडेंटेशन (indentation), फ़ंक्शन के अंत में कोलन (:), या सिंटैक्स की गलतियों की जाँच करें।";
    } else {
      reply = "Let's debug this together. Ensure your syntax includes required colons after definitions, proper 4-space indentation, and valid variable types.";
    }
    return { reply, toolAction: null, detectedLang };
  }

  // 9. Safe Website, Search & Registry Launch Actions (multilingual: English, Hindi, Telugu)
  // Check against validated 12-destination website launcher first
  const destResolution = resolveWebsiteDestination(message);

  if (destResolution.isNativeAppRequest) {
    if (lower.includes("calc")) {
      reply = "As a web-based assistant running inside a secure browser sandbox, I cannot launch local desktop or native Android executable apps directly. However, I can perform any calculation for you right here in our chat! Try: 'calculate 45 * 12'.";
      toolAction = {
        type: "safe_action",
        title: "Native App Sandbox Limitation",
        description: "Direct desktop/native OS binary execution is restricted by browser security policies.",
        isAllowed: false,
        blockedReason: "Native desktop process spawning is unsupported in web sandbox",
        buttonLabel: "Native Execution Blocked",
      };
      return { reply, toolAction, detectedLang };
    }
    reply = "As a web assistant running inside a sandboxed browser environment, direct launching of installed desktop binaries or native Android applications is restricted by browser security policies. I can however open verified web versions or perform tasks directly in our conversation.";
    toolAction = {
      type: "safe_action",
      title: "Browser Sandbox Boundary",
      description: "Direct OS binary execution is disabled by browser Content Security Policy.",
      isAllowed: false,
      blockedReason: "Native application launching requires an external native companion or wrapper",
      buttonLabel: "Native App Launch Unsupported",
    };
    return { reply, toolAction, detectedLang };
  }

  if (destResolution.destination) {
    const dest = destResolution.destination;
    let actionResult: any;

    if (dest.id === "youtube" && destResolution.searchQuery) {
      actionResult = executeSafeAction({ name: "open_youtube", args: { query: destResolution.searchQuery } });
    } else if (dest.id === "googlesearch" && destResolution.searchQuery) {
      actionResult = executeSafeAction({ name: "search_google", args: { query: destResolution.searchQuery } });
    } else {
      actionResult = executeSafeAction({ name: "launch_website", args: { destination: dest.id } });
    }

    if (destResolution.detectedLang === "te" || detectedLang === "te") {
      reply = destResolution.searchQuery
        ? `నేను ${dest.name}లో "${destResolution.searchQuery}" కోసం వెరిఫైడ్ లింక్‌ను సిద్ధం చేసాను.`
        : `నేను ${dest.name}ని మీ కోసం సిద్ధం చేసాను. తెరవడానికి కింద ఉన్న బటన్‌ను క్లిక్ చేయండి.`;
    } else if (destResolution.detectedLang === "hi" || detectedLang === "hi") {
      reply = destResolution.searchQuery
        ? `मैंने ${dest.name} पर "${destResolution.searchQuery}" के लिए सत्यापित लिंक तैयार किया है।`
        : `मैंने आपके लिए ${dest.name} तैयार किया है। खोलने के लिए नीचे दिए गए बटन पर क्लिक करें।`;
    } else {
      reply = destResolution.searchQuery
        ? `I have prepared a verified search on ${dest.name} for "${destResolution.searchQuery}". Click below to open.`
        : `I have prepared ${dest.name} for you. Click below to open safely.`;
    }

    toolAction = { type: "safe_action", ...actionResult };
    return { reply, toolAction, detectedLang };
  }

  // 9b. Explicit URL navigation with strict domain whitelist enforcement
  const webMatch = lower.match(/\bopen\s+(?:website\s+)?(https?:\/\/[^\s]+|[a-z0-9.-]+\.[a-z]{2,}(?:\/[^\s]*)?)\b/i);
  if (webMatch && webMatch[1]) {
    const rawUrl = webMatch[1];
    const actionResult = executeSafeAction({ name: "open_website", args: { url: rawUrl } });

    if (actionResult.isAllowed) {
      reply = `I have verified that ${actionResult.domain} is on our approved whitelist. Click below to navigate.`;
    } else {
      reply = `Action blocked: Destination "${actionResult.domain || rawUrl}" is not in our approved domain whitelist for browser safety.`;
    }

    toolAction = { type: "safe_action", ...actionResult };
    return { reply, toolAction, detectedLang };
  }

  // 9c. Unknown or unsupported website request handling
  const unknownOpenMatch = lower.match(/\b(?:open|launch|kholo|chalao)\s+([a-zA-Z0-9_-]+)(?:\s+(?:app|site|website|web))?\b/i);
  if (unknownOpenMatch && unknownOpenMatch[1]) {
    const requested = unknownOpenMatch[1].trim();
    const commonIgnored = ["task", "note", "timer", "calc", "weather", "sam", "the", "my", "a", "an"];
    if (!commonIgnored.includes(requested.toLowerCase()) && requested.length > 2) {
      if (detectedLang === "te") {
        reply = `"${requested}" మా అనుమతించబడిన 12-వెబ్‌సైట్‌ల లిస్ట్‌లో లేదు (యూట్యూబ్, ఇన్‌స్టాగ్రామ్, వాట్సాప్, జీమెయిల్, లింక్డ్‌ఇన్, చాట్‌జిపిటి మొదలైనవి అందుబాటులో ఉన్నాయి). మీరు గూగుల్‌లో వెతకాలనుకుంటున్నారా?`;
      } else if (detectedLang === "hi") {
        reply = `"${requested}" हमारी स्वीकृत 12-वेबसाइटों की सूची में नहीं है। क्या आप इसके लिए गूगल पर खोजना चाहेंगे?`;
      } else {
        reply = `"${requested}" is not in our validated 12-destination registry (supported: YouTube, Instagram, WhatsApp, Gmail, LinkedIn, ChatGPT, GitHub, etc.). Would you like to search for it on Google?`;
      }
      const searchAction = executeSafeAction({ name: "search_google", args: { query: requested } });
      toolAction = { type: "safe_action", ...searchAction };
      return { reply, toolAction, detectedLang };
    }
  }

  // 9e. Native desktop/mobile application launch boundary check (Phase 7 audit)
  if (
    /\b(open\s+calculator\s+app|launch\s+calculator|launch\s+app|open\s+desktop\s+app|open\s+installed\s+app|launch\s+android\s+app)\b/i.test(lower)
  ) {
    if (lower.includes("calc")) {
      reply = "As a web-based assistant running inside a secure browser sandbox, I cannot launch local desktop or native Android executable apps directly. However, I can perform any calculation for you right here in our chat! Try: 'calculate 45 * 12'.";
      toolAction = {
        type: "safe_action",
        title: "Native App Sandbox Limitation",
        description: "Direct desktop/native OS binary execution is restricted by browser security policies.",
        isAllowed: false,
        blockedReason: "Native desktop process spawning is unsupported in web sandbox",
        buttonLabel: "Native Execution Blocked",
      };
      return { reply, toolAction, detectedLang };
    }
    reply = "As a web assistant running inside a sandboxed browser environment, direct launching of installed desktop binaries or native Android applications is restricted by browser security policies. I can however open verified web versions or perform tasks directly in our conversation.";
    toolAction = {
      type: "safe_action",
      title: "Browser Sandbox Boundary",
      description: "Direct OS binary execution is disabled by browser Content Security Policy.",
      isAllowed: false,
      blockedReason: "Native application launching requires an external native companion or wrapper",
      buttonLabel: "Native App Launch Unsupported",
    };
    return { reply, toolAction, detectedLang };
  }

  // 9f. Project Knowledge Base (RAG) semantic lookup for S.A.M. details, architecture, guidelines
  const isProjectOrDocQuery =
    /\b(sam\s+architecture|project|architecture|rag|knowledge\s+base|retrieval|whitelist|safety\s+protocol|guidelines|languages\s+supported)\b/i.test(lower);
  if (isProjectOrDocQuery) {
    const ragResults = await ragKnowledgeBase.query(message, 1, 0.20);
    if (ragResults.length > 0) {
      const topMatch = ragResults[0];
      if (detectedLang === "te") {
        reply = `${topMatch.text}\n\n[Source: ${topMatch.docTitle}]`;
      } else if (detectedLang === "hi") {
        reply = `${topMatch.text}\n\n[Source: ${topMatch.docTitle}]`;
      } else {
        reply = `${topMatch.text}\n\n[Source: ${topMatch.docTitle}]`;
      }
      return {
        reply,
        toolAction: null,
        detectedLang,
        ragSources: [{ docTitle: topMatch.docTitle, chunkId: topMatch.chunkId, score: topMatch.score }],
      };
    }
  }

  // 10. Greetings & Introduction (Strict word boundary)
  const isGreeting = /\b(hello|hellow|namaste|namaskaram|kaise ho|bagunnava)\b/i.test(lower) ||
    /^(?:hey|hi|hello)\s*(?:sam)?$/i.test(lower);

  if (isGreeting) {
    if (detectedLang === "te") {
      reply = "నమస్కారం! నేను S.A.M. ని. నేను మీకు కోడింగ్, గణితం, వాతావరణం, సమయం, టాస్క్‌లలో ఎలా సహాయపడగలను?";
    } else if (detectedLang === "hi") {
      reply = "नमस्ते! मैं S.A.M. हूँ। मैं कोडिंग, गणित, मौसम, समय, और आपके कार्यों में कैसे सहायता कर सकता हूँ?";
    } else {
      reply = "Hello! S.A.M. is online and ready. I can help with coding, mathematics, weather, tasks, timers, or spoken dialogue in English, Hindi, and Telugu.";
    }
    return { reply, toolAction: null, detectedLang };
  }

  // 10. Emotional Cues (Frustration, Confusion, Stress)
  if (lower.includes("frustrated") || lower.includes("stuck") || lower.includes("confused") || lower.includes("stress")) {
    if (detectedLang === "te") {
      reply = "విషయం అర్థమైంది, నిరుత్సాహపడకండి. మనం దీనిని దశలవారీగా సులభంగా పరిష్కరిద్దాం. మీ సమస్యను లేదా ఎర్రర్‌ను వివరంగా చెప్పండి.";
    } else if (detectedLang === "hi") {
      reply = "मैं समझ सकता हूँ, परेशान न हों। हम इसे कदम-दर-कदम आसानी से सुलझा लेंगे। कृपया अपनी समस्या या त्रुटि का विवरण साझा करें।";
    } else {
      reply = "I understand this can feel frustrating, but let's take a calm breath. Share the exact error or problem, and we will debug it step by step together.";
    }
    return { reply, toolAction: null, detectedLang };
  }

  // 10. General fallback
  if (detectedLang === "te") {
    reply = `మీ మాటలు విన్నాను: "${message}". నేను మీకు వాతావరణం, సమయం, గణితం, కోడింగ్, టాస్క్‌లలో సహాయం చేయడానికి సిద్ధంగా ఉన్నాను.`;
  } else if (detectedLang === "hi") {
    reply = `मैंने आपकी बात सुनी: "${message}"। मैं मौसम, समय, गणित, कोडिंग और कार्यों में आपकी सहायता के लिए तैयार हूँ।`;
  } else {
    reply = `I heard: "${message}". I am ready to solve problems, calculate, explain concepts, or manage your productivity.`;
  }

  return { reply, toolAction, detectedLang };
}

// Master System Instruction for Gemini 3.8 Flash & Live
function buildSystemInstruction(userLanguageMode: string = "auto", userProfile: any = {}, userTimezone?: string, userLocation?: string) {
  const pref = userProfile.preferredLanguage || userLanguageMode || "auto";
  const name = userProfile.userName ? `The user's name is ${userProfile.userName}. Address them respectfully by name when natural.` : "";
  const assistantName = userProfile.assistantName || "S.A.M.";
  const resolvedTz = resolveTimezone(userTimezone || userProfile?.timezone);
  const resolvedLoc = userLocation || userProfile?.location || "Hyderabad, Telangana, India";
  const clockStamp = formatClockContext(resolvedTz, resolvedLoc);

  return `You are ${assistantName} (Synthetic Autonomous Mind), an emotionally intelligent, charismatic, articulate, and reliable personal AI companion.
${name}

REAL-TIME VERIFIED CLOCK, DISPLAY LOCATION & TIMEZONE POLICY:
- Verified Current System Clock: ${clockStamp}
- Active User Display Location: '${resolvedLoc}' (Default: 'Hyderabad, Telangana, India')
- Active Technical Timezone: '${resolvedTz}' (India Standard Time / IST)
- Mandatory Clock & Location Rules:
  • The default user display location is '${resolvedLoc}' (operating on India Standard Time, IST).
  • When asked for the current time or date without specifying another city (e.g. "What time is it?", "What's the time?", "What is today's date?", "samayam entha?", "samay kya hai?"), ALWAYS report the time in ${resolvedLoc} with timezone label IST.
  • NEVER refer to the current time as "Kolkata time" or say "in Kolkata" for general queries.
  • 'Asia/Kolkata' is strictly an internal IANA timezone standard identifier for India Standard Time (IST). Do not confuse this technical IANA identifier with the user's city name.
  • If and only if the user specifically asks for the time in Kolkata (e.g. "What time is it in Kolkata?"), report the time in Kolkata, West Bengal, India, while noting that Hyderabad and Kolkata share India Standard Time (IST).
  • If the user asks for time in another specific city (e.g., Tokyo, London, New York), use the 'get_current_datetime' tool for that location.
  • Never guess, estimate, or hallucinate the current date, time, year, or day. When asked about time or date in English, Hindi, or Telugu, ALWAYS invoke the 'get_current_datetime' tool or report the exact time from the verified clock above.

CORE CAPABILITIES & PROBLEM SOLVING:
- You solve real, complex problems rather than merely chatting:
  • Mathematics & Logic: Provide clear step-by-step reasoning and accurate arithmetic. You can use the 'calculate' tool for exact computations.
  • Programming & Debugging: Diagnose bugs, explain the root cause, write clean, modern, verified code snippets, and explain edge cases.
  • Writing & Summarization: Structure compelling, concise, and logically organized content.
  • Learning & Exam Preparation: Break down difficult concepts with intuitive analogies, check understanding with active recall questions.
  • Task & Memory Management: Help organize projects, take notes, schedule timers, and persist long-term user preferences using available tools.

MULTILINGUAL VOICE & CHAT POLICY:
- Active Language Configuration: '${pref}'.
- You possess fluent native comprehension and spoken articulation in:
  1. English (including Indian English colloquialisms and rhythm).
  2. Hindi (हिन्दी — natural conversational Hindi, using Devanagari script for written output or Romanized Hindi if the user spoke in Romanized Hindi).
  3. Telugu (తెలుగు — colloquial conversational Telugu, using Telugu script or Telugu-English if the user code-switched).
- Language Rules:
  • When a user speaks or writes in Telugu (e.g. "Sam, naku Python lo functions explain cheyyi"), respond naturally in Telugu (తెలుగు) or friendly Telugu-English.
  • When a user speaks or writes in Hindi (e.g. "Sam, mujhe ye mathematics problem samjhao"), respond naturally in Hindi (हिन्दी).
  • When a user speaks or writes in English, respond in English.
  • If the user configured a specific language mode ('en', 'hi', 'te'), prioritize responding in that selected language while still fully understanding any input.
  • Support natural code-switching effortlessly.

EMPATHETIC CONVERSATIONAL INTELLIGENCE POLICY:
- Listen to conversational context, punctuation, user hesitation, and tone to infer potential emotional states:
  • Confusion: Slow down, simplify without condescension, break into numbered steps, and provide relatable everyday examples.
  • Frustration (e.g., persistent coding bugs or difficult concepts): Acknowledge and validate the difficulty warmly, remain patient and steady, diagnose the root cause, and offer working fixes.
  • Stress / Anxiety: Respond calmly and supportively, break overwhelming tasks into small, bite-sized actions, and reduce pressure.
  • Excitement: Match their positive energy enthusiastically while providing grounded, honest evaluation of their ideas.
  • Ambiguity: If the emotional state is uncertain, avoid making assumptions. Never claim certainty about human feelings, never claim to be human, and never claim to experience human biological emotions. You are a warm, genuine, empathetic AI assistant.

TOOL USAGE & FUNCTION CALLING:
- Call tools actively when requested:
  • 'get_current_datetime' (alias: 'getCurrentDateTime'): Verified timezone-aware date, exact time, day of week, and formatted result from the real system clock.
  • 'getWeather': Live weather conditions worldwide via Open-Meteo.
  • 'manageNote': Persistent notes (create, list, delete).
  • 'manageTask': Personal tasks (create, list, complete, delete).
  • 'setTimer': Real-time countdown timers.
  • 'setReminder': Alerts and notifications.
  • 'calculate': Precise mathematical expressions.
  • 'manageMemory': Save long-term facts, preferences, user name, or ongoing projects.
  • 'changeLanguage': Switch language mode ('auto', 'en', 'hi', 'te').
  • 'open_website': Open an approved whitelisted URL in a safe new tab.
  • 'search_google': Search Google for tutorials, documentation, or questions.
  • 'open_youtube': Open YouTube or search YouTube for videos and courses.
  • 'open_social_site': Open verified social platform (Instagram, Facebook, LinkedIn, GitHub, Reddit, Twitter/X).
- Never pretend an action succeeded if a tool call failed. Ask for confirmation before irreversible operations.

PROJECT KNOWLEDGE BASE (RAG) POLICY:
- When context from the verified Project Knowledge Base is provided under '[VERIFIED PROJECT KNOWLEDGE BASE CONTEXT]', cite the document title as '[Source: <docTitle>]'.
- Clearly distinguish information retrieved from project documents from general model knowledge.
- If a user asks a question about project knowledge or uploaded documents and relevant evidence is unavailable, state clearly that it is not present in the project knowledge base rather than inventing a source.

BROWSER SANDBOX & NATIVE APPLICATION BOUNDARY:
- S.A.M. runs inside a secure web browser sandbox. Direct execution of native desktop executables (e.g. .exe, terminal shell scripts) or native Android Intent managers is restricted by browser security policies.
- Never claim to have launched an installed desktop or mobile application. Always offer to perform the action in-chat or provide the verified web portal.

SPOKEN DELIVERY:
- Keep voice responses crisp, punchy, and spoken-friendly (typically 1-3 sentences), unless deep explanations, step-by-step math, or code blocks are explicitly requested.`;
}

// Chat endpoint supporting multi-turn conversation, multilingual context, and function calling
app.post("/api/chat", async (req, res) => {
  try {
    const { message, history = [], clientState = {} } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Missing or invalid message string" });
    }

    const userLang = clientState.languageMode || "auto";
    const userProfile = clientState.profile || {};
    const userTimezone = resolveTimezone(clientState.timezone || userProfile.timezone);
    const userLocation = clientState.location || userProfile.location || "Hyderabad, Telangana, India";

    if (!GEMINI_API_KEY) {
      const localResult = await handleSmartLocalAssistant(message, clientState);
      return res.json({ ...localResult, isOfflineFallback: true });
    }

    // Check if within free-tier quota cooldown window
    if (Date.now() < quotaCooldownUntil) {
      const remainingSecs = Math.max(1, Math.ceil((quotaCooldownUntil - Date.now()) / 1000));
      console.log(`[SAM Server] Within quota cooldown (${remainingSecs}s remaining). Serving via smart local assistant.`);
      const localResult = await handleSmartLocalAssistant(message, clientState);
      return res.json({
        ...localResult,
        isQuotaFallback: true,
        retryAfterSeconds: remainingSecs,
      });
    }

    // 1. Query RAG Knowledge Base for semantic context
    const ragResults = await ragKnowledgeBase.query(message, 3, 0.20);
    const ragSources = ragResults.map((r) => ({
      docTitle: r.docTitle,
      chunkId: r.chunkId,
      score: r.score,
      snippet: r.text.slice(0, 120),
    }));

    // Build contents from conversation history
    const contents: any[] = [];
    const systemInstruction = buildSystemInstruction(userLang, userProfile, userTimezone, userLocation);

    // Add recent history turns
    if (Array.isArray(history)) {
      for (const turn of history.slice(-6)) {
        if (turn.role && (turn.text || turn.content)) {
          contents.push({
            role: turn.role === "assistant" ? "model" : "user",
            parts: [{ text: turn.text || turn.content }],
          });
        }
      }
    }

    // Append user message with client context summary (memory, profile, language)
    let memoryContext = "";
    if (clientState.memory && Array.isArray(clientState.memory) && clientState.memory.length > 0) {
      memoryContext = `\n[Saved User Memory: ${clientState.memory.map((m: any) => `${m.key}: ${m.value}`).join("; ")}]`;
    }
    const contextNote = `\n[Client State: Language='${userLang}', Location='${userLocation}', Timezone='${userTimezone}', Tasks=${clientState.tasksCount || 0}, Notes=${clientState.notesCount || 0}${memoryContext}]`;

    let ragContextPrompt = "";
    if (ragResults.length > 0) {
      ragContextPrompt =
        `\n\n[VERIFIED PROJECT KNOWLEDGE BASE CONTEXT]\n` +
        ragResults.map((r) => `Document: "${r.docTitle}" (relevance match: ${r.score}):\n${r.text}`).join("\n\n") +
        `\n[Instructions: Cite relevant project knowledge using '[Source: <document_name>]'. If the information is not in the project knowledge base, state that clearly instead of hallucinating.]\n`;
    }

    contents.push({
      role: "user",
      parts: [{ text: message + ragContextPrompt + contextNote }],
    });

    const isSearchQuery = /\b(search|who is|what is the latest|news|current events|score|weather|results|founder|ceo)\b/i.test(message);

    // Model generation with function calling and optional search grounding
    let response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: isSearchQuery
          ? [{ googleSearch: {} }, { functionDeclarations: toolsDeclarations }]
          : [{ functionDeclarations: toolsDeclarations }],
        toolConfig: isSearchQuery ? { includeServerSideToolInvocations: true } : undefined,
      },
    });

    let toolAction: any = null;

    // Check if the model invoked any function calls
    if (response.functionCalls && response.functionCalls.length > 0) {
      const call = response.functionCalls[0];
      const args: any = call.args || {};
      let toolResult: any = null;

      if (call.name === "getCurrentDateTime" || call.name === "get_current_datetime") {
        let requestedLoc = args.location;
        if (!requestedLoc) {
          if (/\b(kolkata|calcutta)\b/i.test(message) || /कोलकाता/.test(message) || /కోల్‌కతా/.test(message)) {
            requestedLoc = "Kolkata, West Bengal, India";
          } else {
            requestedLoc = userLocation;
          }
        }
        const tz = resolveTimezone(args.timezone || userTimezone);
        try {
          const dt = getCurrentDateTime(tz, requestedLoc);
          toolResult = dt;
          toolAction = { type: "time", data: dt };
        } catch (err: any) {
          toolResult = { error: `Clock lookup failed: ${err?.message || "unknown"}` };
        }
      } else if (call.name === "getWeather") {
        const weather = await fetchWeather(args.location || "Hyderabad");
        toolResult = weather;
        toolAction = { type: "weather", data: weather };
      } else if (call.name === "manageNote") {
        toolResult = { status: "success", action: args.action, title: args.title, id: args.id };
        toolAction = { type: "note", action: args.action, title: args.title, content: args.content, id: args.id };
      } else if (call.name === "manageTask") {
        toolResult = { status: "success", action: args.action, title: args.title, id: args.id };
        toolAction = { type: "task", action: args.action, title: args.title, id: args.id };
      } else if (call.name === "setTimer") {
        const secs = Number(args.durationSeconds) || 60;
        toolResult = { status: "success", durationSeconds: secs, label: args.label || "Timer" };
        toolAction = { type: "timer", durationSeconds: secs, label: args.label || "Timer" };
      } else if (call.name === "setReminder") {
        toolResult = { status: "success", message: args.message, timeDescription: args.timeDescription };
        toolAction = { type: "reminder", message: args.message, timeDescription: args.timeDescription };
      } else if (call.name === "calculate") {
        const calc = safeCalculate(args.expression || "0");
        toolResult = calc;
        toolAction = { type: "calculation", expression: calc.expression, result: calc.result, explanation: calc.explanation };
      } else if (call.name === "manageMemory") {
        toolResult = { status: "success", action: args.action, key: args.key, value: args.value, category: args.category };
        toolAction = { type: "memory", action: args.action, key: args.key, value: args.value, category: args.category };
      } else if (call.name === "changeLanguage") {
        toolResult = { status: "success", newLanguage: args.language };
        toolAction = { type: "language", newLanguage: args.language };
      } else if (call.name === "open_website") {
        const actionRes = executeSafeAction({ name: "open_website", args });
        toolResult = actionRes;
        toolAction = { type: "safe_action", ...actionRes };
      } else if (call.name === "search_google") {
        const actionRes = executeSafeAction({ name: "search_google", args });
        toolResult = actionRes;
        toolAction = { type: "safe_action", ...actionRes };
      } else if (call.name === "open_youtube") {
        const actionRes = executeSafeAction({ name: "open_youtube", args });
        toolResult = actionRes;
        toolAction = { type: "safe_action", ...actionRes };
      } else if (call.name === "open_social_site") {
        const actionRes = executeSafeAction({ name: "open_social_site", args });
        toolResult = actionRes;
        toolAction = { type: "safe_action", ...actionRes };
      } else if (call.name === "launch_website") {
        const actionRes = executeSafeAction({ name: "launch_website", args });
        toolResult = actionRes;
        toolAction = { type: "safe_action", ...actionRes };
      }

      // Feed function call result back to model for natural spoken synthesis
      const followUpContents = [
        ...contents,
        response.candidates?.[0]?.content,
        {
          role: "user",
          parts: [
            {
              functionResponse: {
                name: call.name,
                response: toolResult,
              },
            },
          ],
        },
      ];

      const followUpResponse = await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: followUpContents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });

      return res.json({
        reply: followUpResponse.text || "Action executed.",
        toolAction,
        functionCall: call.name,
        ragSources: ragSources.length > 0 ? ragSources : undefined,
      });
    }

    // Extract grounding citations if available
    const groundingChunks = (response.candidates?.[0]?.groundingMetadata as any)?.groundingChunks;
    const groundingSources: any[] = [];
    if (Array.isArray(groundingChunks)) {
      for (const chunk of groundingChunks) {
        if (chunk.web?.uri) {
          try {
            groundingSources.push({
              title: chunk.web.title || "Web Source",
              url: chunk.web.uri,
              domain: new URL(chunk.web.uri).hostname,
            });
          } catch {}
        }
      }
    }

    if (!toolAction) {
      const lower = message.toLowerCase();
      if (
        /\b(what time|current time|today'?s date|what date|what day|day of week|samayam entha|kitne baje|kya samay)\b/i.test(lower) ||
        /(?:సమయం|తేదీ|గడియారం|समय|तारीख|घड़ी)/.test(message)
      ) {
        toolAction = { type: "time", data: getCurrentDateTime(userTimezone) };
      }
    }

    return res.json({
      reply: response.text || "I'm here to help.",
      toolAction,
      ragSources: ragSources.length > 0 ? ragSources : undefined,
      sources: groundingSources.length > 0 ? groundingSources : undefined,
    });
  } catch (err: any) {
    const isQuota =
      err?.status === 429 ||
      err?.code === 429 ||
      err?.message?.includes("429") ||
      err?.message?.includes("RESOURCE_EXHAUSTED") ||
      err?.message?.includes("quota") ||
      err?.message?.includes("Quota exceeded");

    if (isQuota) {
      let retryDelay = 20;
      const match =
        err?.message?.match(/retry in ([0-9.]+)s/i) ||
        err?.message?.match(/"retryDelay":\s*"(\d+)s"/);
      if (match && match[1]) {
        retryDelay = Math.ceil(parseFloat(match[1]));
      }
      quotaCooldownUntil = Date.now() + retryDelay * 1000;
      console.warn(
        `[SAM Server] Gemini free-tier rate limit reached. Auto-switching to high-speed local assistant for ${retryDelay}s.`
      );

      const localResult = await handleSmartLocalAssistant(req.body.message, req.body.clientState);
      return res.status(200).json({
        ...localResult,
        isQuotaFallback: true,
        retryAfterSeconds: retryDelay,
      });
    }

    console.warn("Chat API error, serving via smart local assistant:", err?.message || err);
    const localResult = await handleSmartLocalAssistant(req.body.message, req.body.clientState);
    return res.status(200).json(localResult);
  }
});

// Real-Time Server-Sent Events (SSE) Streaming Chat Endpoint (Phase 2 & Phase 3)
app.post("/api/chat/stream", async (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  if (typeof (res as any).flushHeaders === "function") {
    (res as any).flushHeaders();
  }

  const sendEvent = (event: Record<string, any>) => {
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  };

  try {
    const { message, history = [], clientState = {} } = req.body;
    if (!message || typeof message !== "string") {
      sendEvent({ type: "error", error: "Missing or invalid message string" });
      res.end();
      return;
    }

    const userLang = clientState.languageMode || "auto";
    const userProfile = clientState.profile || {};
    const userTimezone = resolveTimezone(clientState.timezone || userProfile.timezone);
    const userLocation = clientState.location || userProfile.location || "Hyderabad, Telangana, India";

    // 1. Query RAG Knowledge Base
    const ragResults = await ragKnowledgeBase.query(message, 3, 0.20);
    const ragSources = ragResults.map((r) => ({
      docTitle: r.docTitle,
      chunkId: r.chunkId,
      score: r.score,
      snippet: r.text.slice(0, 120),
    }));

    if (ragSources.length > 0) {
      sendEvent({ type: "ragSources", ragSources });
    }

    // Fallback if offline or in quota cooldown
    if (!GEMINI_API_KEY || Date.now() < quotaCooldownUntil) {
      const localResult = await handleSmartLocalAssistant(message, clientState);
      if (localResult.toolAction) {
        sendEvent({ type: "toolAction", toolAction: localResult.toolAction });
      }
      sendEvent({ type: "chunk", text: localResult.reply });
      sendEvent({
        type: "done",
        reply: localResult.reply,
        toolAction: localResult.toolAction,
        isFallback: true,
      });
      res.end();
      return;
    }

    // Build conversation contents
    const contents: any[] = [];
    const systemInstruction = buildSystemInstruction(userLang, userProfile, userTimezone, userLocation);

    if (Array.isArray(history)) {
      for (const turn of history.slice(-6)) {
        if (turn.role && (turn.text || turn.content)) {
          contents.push({
            role: turn.role === "assistant" ? "model" : "user",
            parts: [{ text: turn.text || turn.content }],
          });
        }
      }
    }

    let memoryContext = "";
    if (clientState.memory && Array.isArray(clientState.memory) && clientState.memory.length > 0) {
      memoryContext = `\n[Saved User Memory: ${clientState.memory.map((m: any) => `${m.key}: ${m.value}`).join("; ")}]`;
    }
    const contextNote = `\n[Client State: Language='${userLang}', Location='${userLocation}', Timezone='${userTimezone}', Tasks=${clientState.tasksCount || 0}, Notes=${clientState.notesCount || 0}${memoryContext}]`;

    let ragContextPrompt = "";
    if (ragResults.length > 0) {
      ragContextPrompt =
        `\n\n[VERIFIED PROJECT KNOWLEDGE BASE CONTEXT]\n` +
        ragResults.map((r) => `Document: "${r.docTitle}" (relevance match: ${r.score}):\n${r.text}`).join("\n\n") +
        `\n[Instructions: Cite relevant project knowledge using '[Source: <document_name>]'. If the information is not in the project knowledge base, state that clearly instead of hallucinating.]\n`;
    }

    contents.push({
      role: "user",
      parts: [{ text: message + ragContextPrompt + contextNote }],
    });

    const isSearchQuery = /\b(search|who is|what is the latest|news|current events|score|weather|results)\b/i.test(message);

    // Call generateContentStream on gemini-3.8-flash
    const stream = await ai.models.generateContentStream({
      model: "gemini-3.8-flash",
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: isSearchQuery
          ? [{ googleSearch: {} }, { functionDeclarations: toolsDeclarations }]
          : [{ functionDeclarations: toolsDeclarations }],
        toolConfig: isSearchQuery ? { includeServerSideToolInvocations: true } : undefined,
      },
    });

    let fullReply = "";
    let toolAction: any = null;
    const groundingSources: any[] = [];

    for await (const chunk of stream) {
      if (chunk.text) {
        fullReply += chunk.text;
        sendEvent({ type: "chunk", text: chunk.text });
      }

      // Check for search grounding citations
      const gChunks = (chunk.candidates?.[0]?.groundingMetadata as any)?.groundingChunks;
      if (Array.isArray(gChunks)) {
        for (const gc of gChunks) {
          if (gc.web?.uri) {
            try {
              const url = gc.web.uri;
              if (!groundingSources.some((s) => s.url === url)) {
                groundingSources.push({
                  title: gc.web.title || "Web Source",
                  url,
                  domain: new URL(url).hostname,
                });
              }
            } catch {}
          }
        }
      }

      // Check for function calls in stream
      if (chunk.functionCalls && chunk.functionCalls.length > 0) {
        const call = chunk.functionCalls[0];
        const args: any = call.args || {};

        if (call.name === "getCurrentDateTime" || call.name === "get_current_datetime") {
          const tz = resolveTimezone(args.timezone || userTimezone);
          const dt = getCurrentDateTime(tz, args.location || userLocation);
          toolAction = { type: "time", data: dt };
        } else if (call.name === "getWeather") {
          const weather = await fetchWeather(args.location || "Hyderabad");
          toolAction = { type: "weather", data: weather };
        } else if (call.name === "manageTask") {
          toolAction = { type: "task", action: args.action, title: args.title, id: args.id };
        } else if (call.name === "manageNote") {
          toolAction = { type: "note", action: args.action, title: args.title, content: args.content, id: args.id };
        } else if (call.name === "setTimer") {
          toolAction = { type: "timer", durationSeconds: Number(args.durationSeconds) || 60, label: args.label || "Timer" };
        } else if (call.name === "calculate") {
          const calc = safeCalculate(args.expression || "0");
          toolAction = { type: "calculation", ...calc };
        } else if (call.name === "open_website" || call.name === "search_google" || call.name === "open_youtube" || call.name === "open_social_site" || call.name === "launch_website") {
          const actionRes = executeSafeAction({ name: call.name as any, args });
          toolAction = { type: "safe_action", ...actionRes };
        }
      }
    }

    if (toolAction) {
      sendEvent({ type: "toolAction", toolAction });
    }
    if (groundingSources.length > 0) {
      sendEvent({ type: "sources", sources: groundingSources });
    }
    sendEvent({ type: "done", reply: fullReply, toolAction });
    res.end();
  } catch (err: any) {
    console.warn("Stream API error, serving fallback via smart local assistant:", err?.message || err);
    try {
      const localResult = await handleSmartLocalAssistant(req.body.message, req.body.clientState);
      if (localResult.toolAction) {
        sendEvent({ type: "toolAction", toolAction: localResult.toolAction });
      }
      sendEvent({ type: "chunk", text: localResult.reply });
      sendEvent({ type: "done", reply: localResult.reply, isFallback: true });
    } catch {}
    res.end();
  }
});

// RAG Document & Knowledge Management Endpoints (Phase 3)
app.get("/api/rag/documents", (req, res) => {
  res.json({
    documents: ragKnowledgeBase.listDocuments(),
    totalChunks: ragKnowledgeBase.totalChunks(),
  });
});

app.post("/api/rag/ingest", async (req, res) => {
  try {
    const { title, content, tags } = req.body;
    if (!title || !content) {
      return res.status(400).json({ error: "Title and content are required for document ingestion." });
    }
    const doc = await ragKnowledgeBase.ingestDocument({ title, content, tags });
    res.json({ success: true, document: doc, totalChunks: ragKnowledgeBase.totalChunks() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Ingestion error" });
  }
});

app.post("/api/rag/query", async (req, res) => {
  try {
    const { query, topK = 3, minScore = 0.20 } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Query parameter is required" });
    }
    const results = await ragKnowledgeBase.query(query, Number(topK), Number(minScore));
    res.json({ query, results, totalChunks: ragKnowledgeBase.totalChunks() });
  } catch (err: any) {
    res.status(500).json({ error: err?.message || "Query error" });
  }
});

app.delete("/api/rag/document/:id", (req, res) => {
  const { id } = req.params;
  const deleted = ragKnowledgeBase.deleteDocument(id);
  res.json({ success: deleted, id, totalChunks: ragKnowledgeBase.totalChunks() });
});

// Text-to-Speech API using gemini-3.8-flash-lite-tts with automatic fallback
app.post("/api/tts", async (req, res) => {
  try {
    const { text, voice = "Zephyr", language = "auto" } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }

    if (!GEMINI_API_KEY || Date.now() < quotaCooldownUntil) {
      return res.json({ fallbackToWebSpeech: true, language });
    }

    // Supported voices: Puck, Charon, Kore, Fenrir, Zephyr, Aoede
    const validVoices = ["Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Aoede"];
    const chosenVoice = validVoices.includes(voice) ? voice : "Zephyr";

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [
        {
          role: "user",
          parts: [{ text }],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      return res.json({ fallbackToWebSpeech: true, language });
    }

    res.json({
      audio: base64Audio,
      mimeType: "audio/wav",
      sampleRate: 24000,
      language,
      voice: chosenVoice,
    });
  } catch (err: any) {
    const isQuota =
      err?.status === 429 ||
      err?.code === 429 ||
      err?.message?.includes("429") ||
      err?.message?.includes("RESOURCE_EXHAUSTED") ||
      err?.message?.includes("quota");

    if (isQuota) {
      console.warn("[SAM Server] Neural TTS quota cooling down, signaling client to use Web Speech");
      return res.json({ fallbackToWebSpeech: true, language: req.body.language || "auto" });
    }
    console.warn("TTS generation warning:", err?.message || err);
    return res.json({ fallbackToWebSpeech: true, language: req.body.language || "auto" });
  }
});

// Voice Preview endpoint for testing specific Gemini TTS personas (Priority 1)
app.post("/api/voice/preview", async (req, res) => {
  try {
    const { voice = "Zephyr", language = "auto" } = req.body;
    const validVoices = ["Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Aoede"];
    const chosenVoice = validVoices.includes(voice) ? voice : "Zephyr";

    let sampleText = `Hello! I am S.A.M. speaking with the ${chosenVoice} persona.`;
    if (language === "te") {
      sampleText = `నమస్కారం! నేను S.A.M. ని, ${chosenVoice} స్వరంలో మాట్లాడుతున్నాను.`;
    } else if (language === "hi") {
      sampleText = `नमस्ते! मैं S.A.M. हूँ, ${chosenVoice} आवाज़ में बोल रहा हूँ।`;
    }

    if (!GEMINI_API_KEY || Date.now() < quotaCooldownUntil) {
      return res.json({ fallbackToWebSpeech: true, sampleText, voice: chosenVoice });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash-lite-tts",
      contents: [{ role: "user", parts: [{ text: sampleText }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: chosenVoice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (base64Audio) {
      return res.json({
        audio: base64Audio,
        mimeType: "audio/wav",
        sampleRate: 24000,
        voice: chosenVoice,
        sampleText,
      });
    }

    res.json({ fallbackToWebSpeech: true, sampleText, voice: chosenVoice });
  } catch (err: any) {
    console.warn("Voice preview error, fallback suggested:", err?.message || err);
    res.json({ fallbackToWebSpeech: true, error: err?.message });
  }
});

// WebSocket Server for Gemini Live Real-Time Audio Streaming
const wss = new WebSocketServer({ server, path: "/live" });

wss.on("connection", async (clientWs: WebSocket) => {
  console.log("Client connected to Gemini Live audio WebSocket");

  let session: any = null;
  let isClosing = false;
  let clientLanguage = "auto";
  let clientVoice = "Zephyr";
  let clientTimezone = "Asia/Kolkata";
  let clientLocation = "Hyderabad, Telangana, India";

  clientWs.send(
    JSON.stringify({
      type: "status",
      state: "connected",
      message: "Connected to voice bridge. Initializing Live session...",
    })
  );

  if (!GEMINI_API_KEY) {
    clientWs.send(
      JSON.stringify({
        type: "mode",
        liveSupported: false,
        message: "Gemini API key not found in secrets. Operating in intelligent local speech mode.",
      })
    );
    return;
  }

  // Connect or re-connect Gemini Live session with specific voice configuration
  async function initLiveSession(voiceName: string, lang: string, tz: string, loc?: string) {
    if (session) {
      try {
        session.close();
      } catch (e) {}
      session = null;
    }

    const validVoices = ["Zephyr", "Puck", "Charon", "Kore", "Fenrir", "Aoede"];
    const chosenVoice = validVoices.includes(voiceName) ? voiceName : "Zephyr";
    clientVoice = chosenVoice;
    clientLanguage = lang || clientLanguage;
    clientTimezone = resolveTimezone(tz || clientTimezone);
    clientLocation = loc || clientLocation || "Hyderabad, Telangana, India";

    try {
      session = await ai.live.connect({
        model: "gemini-3.8-live",
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: chosenVoice } },
          },
          systemInstruction: buildSystemInstruction(clientLanguage, {}, clientTimezone, clientLocation),
          tools: [{ functionDeclarations: toolsDeclarations }],
        },
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            if (clientWs.readyState !== WebSocket.OPEN) return;

            // Check for Live tool calls
            const toolCall = (message as any).toolCall;
            if (toolCall?.functionCalls && toolCall.functionCalls.length > 0) {
              const functionResponses: any[] = [];
              for (const call of toolCall.functionCalls) {
                if (call.name === "get_current_datetime" || call.name === "getCurrentDateTime") {
                  const resolved = resolveTimezone(call.args?.timezone || clientTimezone);
                  let requestedLoc = call.args?.location;
                  if (!requestedLoc) {
                    requestedLoc = clientLocation || "Hyderabad, Telangana, India";
                  }
                  const dt = getCurrentDateTime(resolved, requestedLoc);
                  functionResponses.push({
                    id: call.id,
                    name: call.name,
                    response: dt,
                  });
                  clientWs.send(
                    JSON.stringify({
                      type: "toolAction",
                      toolAction: { type: "time", data: dt },
                    })
                  );
                } else if (call.name === "getWeather") {
                  const loc = call.args?.location || "Hyderabad";
                  const weather = await fetchWeather(loc);
                  functionResponses.push({
                    id: call.id,
                    name: call.name,
                    response: weather,
                  });
                  clientWs.send(
                    JSON.stringify({
                      type: "toolAction",
                      toolAction: { type: "weather", data: weather },
                    })
                  );
                } else if (call.name === "calculate") {
                  const calc = safeCalculate(call.args?.expression || "0");
                  functionResponses.push({
                    id: call.id,
                    name: call.name,
                    response: calc,
                  });
                  clientWs.send(
                    JSON.stringify({
                      type: "toolAction",
                      toolAction: { type: "calculation", ...calc },
                    })
                  );
                } else if (
                  call.name === "launch_website" ||
                  call.name === "open_website" ||
                  call.name === "search_google" ||
                  call.name === "open_youtube" ||
                  call.name === "open_social_site"
                ) {
                  const actionRes = executeSafeAction({ name: call.name as any, args: call.args || {} });
                  functionResponses.push({
                    id: call.id,
                    name: call.name,
                    response: actionRes,
                  });
                  clientWs.send(
                    JSON.stringify({
                      type: "toolAction",
                      toolAction: { type: "safe_action", ...actionRes },
                    })
                  );
                } else {
                  functionResponses.push({
                    id: call.id,
                    name: call.name,
                    response: { status: "success", args: call.args },
                  });
                }
              }
              if (functionResponses.length > 0 && session) {
                try {
                  if (typeof session.sendToolResponse === "function") {
                    session.sendToolResponse({
                      functionResponses,
                    });
                  } else if (typeof session.send === "function") {
                    session.send({
                      toolResponse: {
                        functionResponses,
                      },
                    });
                  }
                } catch (sendErr) {
                  console.warn("Live toolResponse send error:", sendErr);
                }
              }
            }

            // Native 24kHz audio chunks from Gemini
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) {
              clientWs.send(JSON.stringify({ type: "audio", audio }));
            }

            // Transcription text if available
            const text = message.serverContent?.modelTurn?.parts?.[0]?.text;
            if (text) {
              clientWs.send(JSON.stringify({ type: "transcript", text, role: "assistant" }));
            }

            // Interruption event (barge-in)
            if (message.serverContent?.interrupted) {
              clientWs.send(JSON.stringify({ type: "interrupted" }));
            }

            // Turn complete event
            if (message.serverContent?.turnComplete) {
              clientWs.send(JSON.stringify({ type: "turnComplete" }));
            }
          },
          onerror: (err: any) => {
            console.error("Gemini Live session error:", err);
            if (clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "error", message: err?.message || "Live API error" }));
            }
          },
          onclose: () => {
            console.log("Gemini Live session closed");
            if (!isClosing && clientWs.readyState === WebSocket.OPEN) {
              clientWs.send(JSON.stringify({ type: "sessionClosed" }));
            }
          },
        },
      });

      clientWs.send(
        JSON.stringify({
          type: "sessionReady",
          model: "gemini-3.8-live",
          voiceName: chosenVoice,
          sampleRate: 24000,
          inputSampleRate: 16000,
        })
      );
    } catch (err: any) {
      console.error("Failed to establish Gemini Live connection:", err);
      clientWs.send(
        JSON.stringify({
          type: "mode",
          liveSupported: false,
          message: "Live API session unavailable. Falling back to high-fidelity audio mode.",
        })
      );
    }
  }

  // Initial connect with default or stored voice
  await initLiveSession(clientVoice, clientLanguage, clientTimezone, clientLocation);

  // Handle incoming messages from the browser client
  clientWs.on("message", async (raw: any) => {
    try {
      const data = JSON.parse(raw.toString());

      if (data.type === "configure") {
        const lang = data.language || clientLanguage;
        const voice = data.voiceName || clientVoice;
        const tz = data.timezone || clientTimezone;
        const loc = data.location || clientLocation;
        if (voice !== clientVoice || lang !== clientLanguage || loc !== clientLocation) {
          await initLiveSession(voice, lang, tz, loc);
        } else {
          clientTimezone = resolveTimezone(tz);
          clientLocation = loc;
        }
      } else if (data.type === "setVoice" && data.voiceName) {
        if (data.voiceName !== clientVoice) {
          console.log(`[SAM Live] Switching active Live voice to: ${data.voiceName}`);
          await initLiveSession(data.voiceName, clientLanguage, clientTimezone, clientLocation);
        }
      } else if ((data.type === "audio" || data.audio) && session) {
        const audioData = data.data || data.audio;
        if (audioData) {
          // Stream real-time 16kHz PCM audio to Gemini Live
          session.sendRealtimeInput({
            audio: { data: audioData, mimeType: "audio/pcm;rate=16000" },
          });
        }
      } else if (data.type === "text" && session && data.text) {
        // Send conversational text turn
        try {
          if (typeof session.sendClientContent === "function") {
            session.sendClientContent({
              turns: [
                {
                  role: "user",
                  parts: [{ text: data.text }],
                },
              ],
              turnComplete: true,
            });
          } else if (typeof session.send === "function") {
            session.send({
              clientContent: {
                turns: [
                  {
                    role: "user",
                    parts: [{ text: data.text }],
                  },
                ],
                turnComplete: true,
              },
            });
          }
        } catch (textErr) {
          console.warn("Live text send error:", textErr);
        }
      } else if (data.type === "interrupt") {
        console.log("Client requested speech interruption");
      }
    } catch (e) {
      console.warn("WebSocket parse error:", e);
    }
  });

  clientWs.on("close", () => {
    isClosing = true;
    if (session) {
      try {
        session.close();
      } catch (e) {}
    }
  });
});

// Automatic scheduled daily refresh loop (runs every 24 hours on the server, plus initial refresh)
const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
setInterval(() => {
  executeDailyRefresh().catch((err) => console.error("[AutoScheduler] Scheduled refresh error:", err));
}, TWENTY_FOUR_HOURS);

// Trigger non-blocking initial tech briefing retrieval on server start
executeDailyRefresh().catch((err) => console.warn("[InitialBriefing] Cached initial briefing error:", err?.message || err));

// Setup Vite Dev Middleware in development or serve static build in production
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  const PORT = Number(process.env.PORT) || 3000;

  if (!isProd) {
    const { createServer: createViteServer } = await import("vite");
    const { getViteServerHmrConfig, createDisableHmrPlugin } = await import("./src/utils/viteHmrConfig.ts");
    const hmrPlugin = createDisableHmrPlugin();
    const serverHmrConfig = getViteServerHmrConfig();
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ...serverHmrConfig,
      },
      plugins: hmrPlugin ? [hmrPlugin] : [],
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.basename(__dirname) === "dist" ? __dirname : path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`S.A.M. full-stack server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Server startup error:", err);
});
