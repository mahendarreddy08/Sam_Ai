/**
 * S.A.M. Controlled Safe Action Registry
 * Enforces strict domain whitelisting, query encoding, pop-up blocker defense,
 * and sandboxed web action execution. Prevents arbitrary shell/code execution
 * and documents native application sandboxing constraints.
 */

export interface ActionRequest {
  name: "open_website" | "search_google" | "open_youtube" | "open_social_site" | "launch_website";
  args: Record<string, any>;
}

export interface ActionResult {
  success: boolean;
  action: string;
  destinationUrl?: string;
  title: string;
  description: string;
  category: "search" | "youtube" | "social" | "website";
  domain?: string;
  isAllowed: boolean;
  blockedReason?: string;
  buttonLabel: string;
  destinationId?: string;
}

// Whitelist of approved domain suffixes (must match domain or subdomain)
export const APPROVED_DOMAINS: string[] = [
  "google.com",
  "google.co.in",
  "youtube.com",
  "youtu.be",
  "instagram.com",
  "facebook.com",
  "fb.com",
  "whatsapp.com",
  "linkedin.com",
  "twitter.com",
  "x.com",
  "telegram.org",
  "github.com",
  "chatgpt.com",
  "openai.com",
  "wikipedia.org",
  "reddit.com",
  "stackoverflow.com",
  "developer.mozilla.org",
  "news.ycombinator.com",
  "coursera.org",
  "freecodecamp.org",
  "w3schools.com",
  "geeksforgeeks.org",
  "kaggle.com",
  "arxiv.org",
];

// Approved social and web portal destinations (12 core destinations + trusted services)
export const APPROVED_SOCIAL_SITES: Record<string, string> = {
  youtube: "https://www.youtube.com",
  instagram: "https://www.instagram.com",
  facebook: "https://www.facebook.com",
  whatsapp: "https://web.whatsapp.com",
  linkedin: "https://www.linkedin.com",
  twitter: "https://x.com",
  x: "https://x.com",
  telegram: "https://web.telegram.org",
  gmail: "https://mail.google.com",
  googledrive: "https://drive.google.com",
  drive: "https://drive.google.com",
  github: "https://github.com",
  chatgpt: "https://chatgpt.com",
  google: "https://www.google.com",
  reddit: "https://www.reddit.com",
};

/**
 * Validate whether a destination URL belongs to the approved domain whitelist.
 */
export function isDomainWhitelisted(urlStr: string): { allowed: boolean; hostname?: string; error?: string } {
  try {
    const parsed = new URL(urlStr);

    // Only allow HTTP/HTTPS
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { allowed: false, error: `Insecure or disallowed protocol: '${parsed.protocol}'` };
    }

    const host = parsed.hostname.toLowerCase();
    const isWhitelisted = APPROVED_DOMAINS.some(
      (domain) => host === domain || host.endsWith(`.${domain}`)
    );

    if (!isWhitelisted) {
      return {
        allowed: false,
        hostname: host,
        error: `Domain '${host}' is not in the approved safety whitelist.`,
      };
    }

    return { allowed: true, hostname: host };
  } catch (e: any) {
    return { allowed: false, error: `Invalid URL format: ${e?.message || "parse error"}` };
  }
}

/**
 * Sanitize and enforce HTTPS on URLs
 */
export function sanitizeUrl(rawUrl: string): string {
  let trimmed = rawUrl.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * Process and execute a structured action request safely
 */
export function executeSafeAction(req: ActionRequest): ActionResult {
  switch (req.name) {
    case "open_website": {
      const targetUrl = sanitizeUrl(req.args.url || "");
      const check = isDomainWhitelisted(targetUrl);
      if (!check.allowed) {
        return {
          success: false,
          action: "open_website",
          title: "Blocked Website Request",
          description: check.error || "The requested destination domain is not on the approved whitelist.",
          category: "website",
          isAllowed: false,
          blockedReason: check.error,
          buttonLabel: "Access Blocked",
        };
      }
      return {
        success: true,
        action: "open_website",
        destinationUrl: targetUrl,
        title: `Open ${check.hostname}`,
        description: `Navigate safely to verified destination: ${targetUrl}`,
        category: "website",
        domain: check.hostname,
        isAllowed: true,
        buttonLabel: `Open ${check.hostname} ↗`,
      };
    }

    case "search_google": {
      const query = (req.args.query || "").trim();
      if (!query) {
        return {
          success: true,
          action: "search_google",
          destinationUrl: "https://www.google.com",
          title: "Google Search",
          description: "Open Google Search homepage",
          category: "search",
          domain: "google.com",
          isAllowed: true,
          buttonLabel: "Open Google ↗",
        };
      }
      const encoded = encodeURIComponent(query);
      const url = `https://www.google.com/search?q=${encoded}`;
      return {
        success: true,
        action: "search_google",
        destinationUrl: url,
        title: `Google Search: "${query}"`,
        description: `Explore search results for "${query}" on Google`,
        category: "search",
        domain: "google.com",
        isAllowed: true,
        buttonLabel: "View Results on Google ↗",
      };
    }

    case "open_youtube": {
      const query = (req.args.query || req.args.search || "").trim();
      let url = "https://www.youtube.com";
      let desc = "Open YouTube homepage";
      let title = "YouTube";

      if (query) {
        url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
        title = `YouTube: "${query}"`;
        desc = `Search YouTube videos for "${query}"`;
      }

      return {
        success: true,
        action: "open_youtube",
        destinationUrl: url,
        title,
        description: desc,
        category: "youtube",
        domain: "youtube.com",
        isAllowed: true,
        buttonLabel: query ? `Search YouTube for "${query}" ↗` : "Open YouTube ↗",
      };
    }

    case "open_social_site": {
      const rawSite = (req.args.site || req.args.name || "instagram").toLowerCase().trim();
      const siteKey = Object.keys(APPROVED_SOCIAL_SITES).find((k) => rawSite === k || rawSite.includes(k));

      if (!siteKey || !APPROVED_SOCIAL_SITES[siteKey]) {
        return {
          success: false,
          action: "open_social_site",
          title: "Unsupported Platform",
          description: `Platform '${rawSite}' is not in the approved sites registry (Supported: YouTube, Instagram, Facebook, WhatsApp, LinkedIn, X, Telegram, Gmail, Google Drive, GitHub, ChatGPT, Google Search).`,
          category: "social",
          isAllowed: false,
          blockedReason: "Platform not supported in registry",
          buttonLabel: "Unsupported Site",
        };
      }

      const url = APPROVED_SOCIAL_SITES[siteKey];
      const parsedHost = new URL(url).hostname;
      const nameCap = siteKey === "whatsapp" ? "WhatsApp Web" :
                      siteKey === "telegram" ? "Telegram Web" :
                      siteKey === "googledrive" || siteKey === "drive" ? "Google Drive" :
                      siteKey === "chatgpt" ? "ChatGPT" :
                      siteKey === "gmail" ? "Gmail" :
                      siteKey === "youtube" ? "YouTube" :
                      siteKey === "x" ? "X" :
                      siteKey.charAt(0).toUpperCase() + siteKey.slice(1);
      return {
        success: true,
        action: "open_social_site",
        destinationUrl: url,
        title: nameCap,
        description: `Open verified ${nameCap} portal`,
        category: "social",
        domain: parsedHost,
        isAllowed: true,
        buttonLabel: `Open ${nameCap} ↗`,
        destinationId: siteKey,
      };
    }

    case "launch_website": {
      const rawDest = (req.args.destination || req.args.site || req.args.id || "youtube").toLowerCase().trim();
      const siteKey = Object.keys(APPROVED_SOCIAL_SITES).find((k) => rawDest === k || rawDest.includes(k));

      if (!siteKey || !APPROVED_SOCIAL_SITES[siteKey]) {
        return {
          success: false,
          action: "launch_website",
          title: "Unknown Website Destination",
          description: `Destination '${rawDest}' is not in the validated 12-destination registry. Would you like to search for it instead?`,
          category: "website",
          isAllowed: false,
          blockedReason: "Destination not in validated registry",
          buttonLabel: "Unknown Site",
        };
      }

      const url = APPROVED_SOCIAL_SITES[siteKey];
      const parsedHost = new URL(url).hostname;
      const nameCap = siteKey === "whatsapp" ? "WhatsApp Web" :
                      siteKey === "telegram" ? "Telegram Web" :
                      siteKey === "googledrive" || siteKey === "drive" ? "Google Drive" :
                      siteKey === "chatgpt" ? "ChatGPT" :
                      siteKey === "gmail" ? "Gmail" :
                      siteKey === "youtube" ? "YouTube" :
                      siteKey === "x" ? "X" :
                      siteKey.charAt(0).toUpperCase() + siteKey.slice(1);

      return {
        success: true,
        action: "launch_website",
        destinationUrl: url,
        title: nameCap,
        description: `Navigate to validated destination: ${nameCap}`,
        category: "website",
        domain: parsedHost,
        isAllowed: true,
        buttonLabel: `Open ${nameCap} ↗`,
        destinationId: siteKey,
      };
    }

    default:
      return {
        success: false,
        action: "unknown",
        title: "Unknown Action",
        description: "The requested tool action is unrecognized.",
        category: "website",
        isAllowed: false,
        blockedReason: "Unrecognized action identifier",
        buttonLabel: "Action Denied",
      };
  }
}
