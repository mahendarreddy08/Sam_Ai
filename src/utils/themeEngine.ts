// src/utils/themeEngine.ts - Dynamic Sentiment-Driven Theme Engine for S.A.M.

export type SentimentTheme = "positive" | "neutral" | "intellectual";

export interface ThemeColors {
  name: string;
  label: string;
  ambientGlow: string; // Tailwind gradient classes for background glow
  orbColorA: number;   // Three.js hex color A
  orbColorB: number;   // Three.js hex color B
  orbColorRim: number; // Three.js hex rim color
  auraHex: number;     // Secondary outer shell hex
  badgeColor: string;  // UI badge styling
  accentTailwind: string; // Button / accent styling
}

export const THEME_PALETTES: Record<SentimentTheme, ThemeColors> = {
  positive: {
    name: "warm-gold",
    label: "Warm Gold",
    ambientGlow: "from-amber-500/30 via-yellow-500/18 to-transparent",
    orbColorA: 0xf59e0b, // Warm Amber
    orbColorB: 0xeab308, // Glowing Gold
    orbColorRim: 0xfef08a, // Bright Sun Halo
    auraHex: 0xf59e0b,
    badgeColor: "text-amber-300 bg-amber-950/60 border-amber-800/50",
    accentTailwind: "text-amber-400",
  },
  neutral: {
    name: "calm-blue",
    label: "Calm Blue",
    ambientGlow: "from-sky-500/22 via-cyan-500/12 to-transparent",
    orbColorA: 0x0284c7, // Calm Sky Blue
    orbColorB: 0x0ea5e9, // Azure Ocean
    orbColorRim: 0x38bdf8, // Electric Blue Rim
    auraHex: 0x0284c7,
    badgeColor: "text-sky-300 bg-sky-950/60 border-sky-800/50",
    accentTailwind: "text-sky-400",
  },
  intellectual: {
    name: "cool-violet",
    label: "Cool Violet",
    ambientGlow: "from-violet-600/30 via-purple-600/18 to-transparent",
    orbColorA: 0x7c3aed, // Cool Violet
    orbColorB: 0x9333ea, // Deep Purple
    orbColorRim: 0xc084fc, // Lavender Rim
    auraHex: 0x7c3aed,
    badgeColor: "text-purple-300 bg-purple-950/60 border-purple-800/50",
    accentTailwind: "text-purple-400",
  },
};

/**
 * Fast, robust sentiment analyzer for assistant responses.
 * Detects:
 * - "intellectual": Coding, mathematics, algorithms, system concepts, scientific explanations, step-by-step logic.
 * - "positive": Gratitude, congratulations, delight, enthusiasm, accomplishments, celebratory affirmations.
 * - "neutral": Objective, calm dialogue, direct facts, steady conversational flow.
 */
export function analyzeSentiment(text: string): SentimentTheme {
  if (!text || typeof text !== "string") return "neutral";
  const lower = text.toLowerCase();

  // 1. Intellectual / Analytical Signals
  const intellectualKeywords = [
    "function", "def ", "class ", "const ", "let ", "var ", "algorithm", "parameter",
    "calculate", "computation", "equation", "formula", "syntax", "runtime",
    "compile", "database", "sql", "react", "python", "javascript", "typescript",
    "quantum", "physics", "logic", "proof", "architecture", "component",
    "derivative", "integral", "matrix", "analysis", "explanation", "concept",
    "లెక్కింపు", "సూత్రం", "వివరణ", "కోడ్", // Telugu math/code words
    "सूत्र", "गणना", "व्याख्या", "सिद्धांत", "कोड" // Hindi math/code words
  ];

  // 2. Positive / Encouraging / Warm Gold Signals
  const positiveKeywords = [
    "great", "awesome", "excellent", "wonderful", "congratulations", "proud",
    "glad to hear", "fantastic", "brilliant", "delighted", "perfect", "good job",
    "happy to", "love that", "superb", "terrific", "celebrate", "bravo", "welcome",
    "బాగుంది", "అభినందనలు", "సంతోషం", "చాలా మంచిది", "అద్భుతం", // Telugu positive
    "बहुत अच्छा", "बधाई", "शानदार", "खुशी", "उत्कृष्ट", "धन्यवाद" // Hindi positive
  ];

  // Count matches
  let intCount = 0;
  for (const kw of intellectualKeywords) {
    if (lower.includes(kw)) intCount++;
  }

  let posCount = 0;
  for (const kw of positiveKeywords) {
    if (lower.includes(kw)) posCount++;
  }

  // Check code blocks or formulas
  if (/```|\bdef\b|\bconst\b|\bfunction\b|[0-9]+\s*[\+\-\*\/]\s*[0-9]+/.test(text)) {
    intCount += 2;
  }

  if (intCount > posCount && intCount >= 1) {
    return "intellectual";
  }

  if (posCount >= 1) {
    return "positive";
  }

  return "neutral";
}
