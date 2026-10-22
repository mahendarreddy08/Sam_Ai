/**
 * S.A.M. Voice-Controlled Website Launcher Service
 * 
 * Manages the validated 12-destination website registry with multilingual
 * intent resolution (English, Hindi, Telugu), client-side window navigation,
 * popup-blocker detection, and request deduplication.
 */

export interface WebsiteDestination {
  id: string;
  name: string;
  url: string;
  category: "media" | "social" | "communication" | "productivity" | "ai" | "search";
  aliases: string[];
  description: string;
}

export interface LaunchResult {
  success: boolean;
  destinationId: string;
  destinationName: string;
  url: string;
  popupBlocked: boolean;
  buttonLabel: string;
  requestId: string;
  message: string;
}

// 1. Predefined, strictly validated 12 website destinations
export const WEBSITE_REGISTRY: Record<string, WebsiteDestination> = {
  youtube: {
    id: "youtube",
    name: "YouTube",
    url: "https://www.youtube.com",
    category: "media",
    aliases: [
      "youtube", "yt", "you tube",
      "యూట్యూబ్", "యుట్యూబ్",
      "यूट्यूब", "युट्यूब",
    ],
    description: "Stream videos, podcasts, and music on YouTube",
  },
  instagram: {
    id: "instagram",
    name: "Instagram",
    url: "https://www.instagram.com",
    category: "social",
    aliases: [
      "instagram", "insta", "ig",
      "ఇన్‌స్టాగ్రామ్", "ఇన్‌స్టా",
      "इंस्टाग्राम", "इंस्टा",
    ],
    description: "Photos, reels, and stories on Instagram",
  },
  facebook: {
    id: "facebook",
    name: "Facebook",
    url: "https://www.facebook.com",
    category: "social",
    aliases: [
      "facebook", "fb", "face book",
      "ఫేస్‌బుక్", "ఫేస్బుక్",
      "फेसबुक",
    ],
    description: "Social networking and community on Facebook",
  },
  whatsapp: {
    id: "whatsapp",
    name: "WhatsApp Web",
    url: "https://web.whatsapp.com",
    category: "communication",
    aliases: [
      "whatsapp", "whatsapp web", "wa", "whats app",
      "వాట్సాప్", "వాట్సాప్ వెబ్", "వాట్సప్",
      "व्हाट्सएप", "व्हाट्सएप वेब", "व्हाट्सऐप",
    ],
    description: "Fast, secure private messaging on WhatsApp Web",
  },
  linkedin: {
    id: "linkedin",
    name: "LinkedIn",
    url: "https://www.linkedin.com",
    category: "social",
    aliases: [
      "linkedin", "linked in",
      "లింక్డ్‌ఇన్", "లింక్డిన్",
      "लिंक्डइन",
    ],
    description: "Professional networking and careers on LinkedIn",
  },
  x: {
    id: "x",
    name: "X",
    url: "https://x.com",
    category: "social",
    aliases: [
      "x", "twitter", "tweet",
      "ట్విట్టర్", "ఎక్స్",
      "ट्विटर", "एक्स",
    ],
    description: "Real-time updates, news, and conversation on X (Twitter)",
  },
  telegram: {
    id: "telegram",
    name: "Telegram Web",
    url: "https://web.telegram.org",
    category: "communication",
    aliases: [
      "telegram", "telegram web", "tg",
      "టెలిగ్రామ్", "టెలిగ్రామ్ వెబ్",
      "टेलीग्राम", "टेलीग्राम वेब",
    ],
    description: "Cloud-based messaging on Telegram Web",
  },
  gmail: {
    id: "gmail",
    name: "Gmail",
    url: "https://mail.google.com",
    category: "communication",
    aliases: [
      "gmail", "google mail", "mail", "email",
      "జీమెయిల్", "ఈమెయిల్", "మెయిల్",
      "जीमेल", "गूगल मेल", "मेल", "ईमेल",
    ],
    description: "Secure, reliable email by Google",
  },
  googledrive: {
    id: "googledrive",
    name: "Google Drive",
    url: "https://drive.google.com",
    category: "productivity",
    aliases: [
      "google drive", "gdrive", "drive",
      "గూగుల్ డ్రైవ్", "డ్రైవ్",
      "गूगल ड्राइव", "ड्राइव",
    ],
    description: "Cloud storage, documents, and backups on Google Drive",
  },
  github: {
    id: "github",
    name: "GitHub",
    url: "https://github.com",
    category: "productivity",
    aliases: [
      "github", "git hub", "git",
      "గిట్‌హబ్", "గిట్ హబ్", "గిట్",
      "गिटहब", "गिट",
    ],
    description: "Open source repositories, code hosting, and Git on GitHub",
  },
  chatgpt: {
    id: "chatgpt",
    name: "ChatGPT",
    url: "https://chatgpt.com",
    category: "ai",
    aliases: [
      "chatgpt", "chat gpt", "openai", "gpt",
      "చాట్‌జిపిటి", "చాట్ జిపిటి",
      "चैटजीपीटी", "चैट जीपीटी",
    ],
    description: "Conversational AI and reasoning with ChatGPT",
  },
  googlesearch: {
    id: "googlesearch",
    name: "Google Search",
    url: "https://www.google.com",
    category: "search",
    aliases: [
      "google search", "google", "search google",
      "గూగుల్", "గూగుల్ సెర్చ్",
      "गूगल", "गूगल सर्च",
    ],
    description: "Explore the web with Google Search",
  },
};

// Request deduplication cache
const launchedRequestIds = new Set<string>();

/**
 * Clean up old request IDs periodically to prevent memory growth
 */
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    if (launchedRequestIds.size > 200) {
      launchedRequestIds.clear();
    }
  }, 10 * 60 * 1000);
}

/**
 * Resolves natural language user query to a trusted destination in the registry.
 * Supports English, Hindi ("kholo", "chalao", "shuru karo"), Telugu ("open cheyyi", "teruvu", "chupinchu"),
 * and mixed code-switching expressions.
 */
export function resolveWebsiteDestination(rawText: string): {
  destination: WebsiteDestination | null;
  detectedLang: "en" | "hi" | "te";
  searchQuery?: string;
  isNativeAppRequest?: boolean;
} {
  const text = (rawText || "").toLowerCase().trim();

  // Language detection
  const hasTelugu = /[\u0C00-\u0C7F]/.test(rawText) || /\b(cheyyi|teruvu|chupinchu|naku|kavali|chey)\b/i.test(text);
  const hasHindi = /[\u0900-\u097F]/.test(rawText) || /\b(kholo|chalao|khol|kholiye|batao)\b/i.test(text);
  const detectedLang: "en" | "hi" | "te" = hasTelugu ? "te" : hasHindi ? "hi" : "en";

  // Check for native OS app request (e.g., calculator app, notepad)
  if (/\b(calculator\s+app|notepad\s+app|desktop\s+app|installed\s+app|exe\b|apk\b)\b/i.test(text)) {
    return { destination: null, detectedLang, isNativeAppRequest: true };
  }

  // Multilingual action trigger verbs:
  // English: open, launch, go to, visit, start, navigate to
  // Hindi: kholo (खोलो), chalao (चलाओ), shuru karo (शुरू करो), par jao (पर जाओ)
  // Telugu: open cheyyi (ఓపెన్ చెయ్యి), teruvu (తెరువు), chupinchu (చూపించు), loki vellu (లోకి వెళ్ళు)
  const isLaunchIntent =
    /\b(open|launch|goto|go\s+to|visit|show|start|navigate)\b/i.test(text) ||
    /\b(kholo|khol|kholiye|chalao|chalu\s+karo)\b/i.test(text) ||
    /\b(open\s*cheyyi|open\s*chey|teruvu|chupinchu|vellu)\b/i.test(text) ||
    /(?:खोलो|चलाओ|खोलें|शुरू\s*करें)/.test(rawText) ||
    /(?:ఓపెన్\s*చేయి|ఓపెన్\s*చెయ్యి|తెరువు|చూపించు)/.test(rawText);

  // Search queries for YouTube or Google Search specifically
  const ytSearchMatch = rawText.match(/(?:search\s+youtube\s+for|youtube\s+lo\s+search\s+cheyyi|youtube\s+par\s+search\s+karo)\s+(.+)/i);
  if (ytSearchMatch && ytSearchMatch[1]) {
    return {
      destination: WEBSITE_REGISTRY.youtube,
      detectedLang,
      searchQuery: ytSearchMatch[1].trim(),
    };
  }

  const gSearchMatch = rawText.match(/(?:search\s+google\s+for|google\s+search\s+for|google\s+lo\s+search\s+cheyyi|google\s+par\s+search\s+karo)\s+(.+)/i);
  if (gSearchMatch && gSearchMatch[1]) {
    return {
      destination: WEBSITE_REGISTRY.googlesearch,
      detectedLang,
      searchQuery: gSearchMatch[1].trim(),
    };
  }

  // Flatten and sort all (destination, alias) pairs by alias length descending
  // This guarantees longer specific phrases ("telegram web", "chatgpt", "google drive")
  // match before short abbreviations ("tg", "wa", "yt", "x").
  const allEntries: { dest: WebsiteDestination; alias: string }[] = [];
  for (const dest of Object.values(WEBSITE_REGISTRY)) {
    for (const alias of dest.aliases) {
      allEntries.push({ dest, alias: alias.toLowerCase() });
    }
  }
  allEntries.sort((a, b) => b.alias.length - a.alias.length);

  for (const entry of allEntries) {
    const aliasLower = entry.alias;
    const regex = new RegExp(`(^|\\s|[^a-zA-Z0-9])${escapeRegExp(aliasLower)}($|\\s|[^a-zA-Z0-9])`, "i");
    if (regex.test(text)) {
      const isDirect = text.length < 50 || isLaunchIntent;
      if (isDirect) {
        return { destination: entry.dest, detectedLang };
      }
    }
  }

  return { destination: null, detectedLang };
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Execute client-side website launching with popup-blocker detection
 * and unique requestId deduplication.
 */
export function launchWebsite(
  destIdOrKey: string,
  options: {
    requestId?: string;
    searchQuery?: string;
    customUrl?: string;
  } = {}
): LaunchResult {
  const normKey = destIdOrKey.toLowerCase().replace(/[\s_-]/g, "");
  const dest =
    WEBSITE_REGISTRY[normKey] ||
    Object.values(WEBSITE_REGISTRY).find((d) => d.id === normKey || d.name.toLowerCase() === destIdOrKey.toLowerCase());

  const reqId = options.requestId || `launch-${destIdOrKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  // Deduplication check: prevent multiple tabs from opening if re-evaluated or re-streamed
  if (launchedRequestIds.has(reqId)) {
    console.log(`[WebsiteLauncher] Request ${reqId} already executed; skipping duplicate navigation.`);
    const matched = dest || { name: destIdOrKey, url: options.customUrl || "#" };
    return {
      success: true,
      destinationId: dest?.id || normKey,
      destinationName: matched.name,
      url: matched.url,
      popupBlocked: false,
      buttonLabel: `Open ${matched.name} ↗`,
      requestId: reqId,
      message: `${matched.name} already launched.`,
    };
  }

  if (!dest && !options.customUrl) {
    return {
      success: false,
      destinationId: normKey,
      destinationName: destIdOrKey,
      url: "",
      popupBlocked: false,
      buttonLabel: "Unknown Site",
      requestId: reqId,
      message: `Destination "${destIdOrKey}" is not in the validated website registry.`,
    };
  }

  let targetUrl = options.customUrl || dest!.url;
  let targetTitle = dest ? dest.name : "Website";

  // Handle queries for YouTube or Google Search
  if (options.searchQuery && dest) {
    if (dest.id === "youtube") {
      targetUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(options.searchQuery)}`;
      targetTitle = `YouTube: "${options.searchQuery}"`;
    } else if (dest.id === "googlesearch") {
      targetUrl = `https://www.google.com/search?q=${encodeURIComponent(options.searchQuery)}`;
      targetTitle = `Google: "${options.searchQuery}"`;
    }
  }

  // Mark request ID as processed to guarantee single-tab behavior
  launchedRequestIds.add(reqId);

  let popupBlocked = false;
  try {
    if (typeof window !== "undefined") {
      // Attempt opening in new tab
      const win = window.open(targetUrl, "_blank", "noopener,noreferrer");
      if (!win || win.closed || typeof win.closed === "undefined") {
        popupBlocked = true;
        console.warn(`[WebsiteLauncher] Browser popup blocker prevented automatic navigation to ${targetUrl}. Fallback card displayed.`);
      }
    }
  } catch (err) {
    popupBlocked = true;
    console.warn("[WebsiteLauncher] window.open threw error:", err);
  }

  return {
    success: true,
    destinationId: dest ? dest.id : normKey,
    destinationName: targetTitle,
    url: targetUrl,
    popupBlocked,
    buttonLabel: `Open ${targetTitle} ↗`,
    requestId: reqId,
    message: popupBlocked
      ? `Popup blocked by browser. Click the button below to open ${targetTitle}.`
      : `Successfully opened ${targetTitle}.`,
  };
}

/**
 * Return list of all 12 registered websites
 */
export function getRegisteredWebsites(): WebsiteDestination[] {
  return Object.values(WEBSITE_REGISTRY);
}
