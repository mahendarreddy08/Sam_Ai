// src/utils/datetime.ts - Reliable, Real-Time Runtime Clock & Timezone Formatter

export const DEFAULT_DISPLAY_LOCATION = "Hyderabad, Telangana, India";
export const DEFAULT_TIMEZONE_IDENTIFIER = "Asia/Kolkata";
export const DEFAULT_TIMEZONE_LABEL = "IST";

export interface DateTimeResult {
  date: string;
  time: string;
  timeShort: string;
  time24: string;
  dayOfWeek: string;
  timezone: string; // Official IANA timezone identifier (e.g. "Asia/Kolkata")
  timezoneLabel: string; // Friendly label (e.g. "IST", "India Standard Time")
  locationName: string; // Human-readable location (default: "Hyderabad, Telangana, India")
  iso: string;
  timestampMs: number;
  formattedText: string;
  formattedHindi: string;
  formattedTelugu: string;
}

/**
 * Validates and normalizes an IANA timezone string.
 * If invalid or empty, falls back to "Asia/Kolkata" for users in India.
 */
export function resolveTimezone(tz?: string): string {
  const fallback = DEFAULT_TIMEZONE_IDENTIFIER;
  if (!tz || typeof tz !== "string") return fallback;
  const clean = tz.trim();
  if (!clean || clean.toLowerCase() === "local" || clean.toLowerCase() === "auto") {
    return fallback;
  }
  try {
    // Validate with Intl.DateTimeFormat
    Intl.DateTimeFormat(undefined, { timeZone: clean });
    return clean;
  } catch {
    return fallback;
  }
}

/**
 * Returns a human-friendly timezone label (e.g., "IST" or "India Standard Time").
 */
export function getTimezoneLabel(ianaTz: string): string {
  const norm = resolveTimezone(ianaTz);
  if (norm === "Asia/Kolkata" || norm === "Asia/Calcutta") {
    return "IST";
  }
  if (norm === "UTC" || norm === "Etc/UTC") {
    return "UTC";
  }
  // Try extracting short name using Intl format
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: norm, timeZoneName: "short" }).formatToParts(new Date());
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart && tzPart.value) return tzPart.value;
  } catch {}
  return norm;
}

/**
 * Resolves human-readable location name, ensuring default is Hyderabad, Telangana, India
 * unless the user specifically requested another city/location (e.g., Kolkata, Delhi, Tokyo).
 */
export function resolveLocationName(customLocation?: string, ianaTz?: string): string {
  if (customLocation && typeof customLocation === "string" && customLocation.trim()) {
    const clean = customLocation.trim();
    // If the input was literally the technical IANA string "Asia/Kolkata", map to default display location
    if (clean === "Asia/Kolkata" || clean.toLowerCase() === "asia/kolkata") {
      return DEFAULT_DISPLAY_LOCATION;
    }
    return clean;
  }

  const tz = resolveTimezone(ianaTz);
  if (tz === "Asia/Kolkata" || tz === "Asia/Calcutta") {
    return DEFAULT_DISPLAY_LOCATION;
  }

  // Common foreign timezones
  if (tz === "America/New_York") return "New York, USA";
  if (tz === "America/Los_Angeles") return "San Francisco, USA";
  if (tz === "Europe/London") return "London, UK";
  if (tz === "Asia/Tokyo") return "Tokyo, Japan";
  if (tz === "UTC") return "UTC (Universal Time)";

  return tz;
}

/**
 * Fetches the actual current system timestamp and formats it precisely
 * for the requested timezone and human-readable location.
 *
 * Notice: The IANA timezone identifier (e.g. "Asia/Kolkata") is strictly separated
 * from the display location ("Hyderabad, Telangana, India") and timezone label ("IST").
 */
export function getCurrentDateTime(userTimezone?: string, userLocationName?: string): DateTimeResult {
  const timezone = resolveTimezone(userTimezone);
  const locationName = resolveLocationName(userLocationName, timezone);
  const timezoneLabel = getTimezoneLabel(timezone);
  const now = new Date();

  // 1. Time 12-hour with seconds
  const timeFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  const time = timeFormatter.format(now);

  // 2. Time 12-hour short (hour:minute AM/PM)
  const timeShortFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const timeShort = timeShortFormatter.format(now);

  // 3. Time 24-hour (HH:mm:ss)
  const time24Formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const time24 = time24Formatter.format(now);

  // 4. Date (Month Day, Year)
  const dateFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const date = dateFormatter.format(now);

  // 5. Day of week
  const dayFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  });
  const dayOfWeek = dayFormatter.format(now);

  // 6. Multilingual natural phrasing: explicitly specifies locationName and timezoneLabel
  const formattedText = `The current time in ${locationName} is ${timeShort} (${timezoneLabel}) on ${dayOfWeek}, ${date}.`;
  const formattedHindi = `${locationName} में अभी समय ${timeShort} (${timezoneLabel}) है, और आज ${dayOfWeek}, तारीख ${date} है।`;
  const formattedTelugu = `${locationName}లో ప్రస్తుతం సమయం ${timeShort} (${timezoneLabel}), మరియు ఈ రోజు తేదీ ${date} (${dayOfWeek}).`;

  return {
    date,
    time,
    timeShort,
    time24,
    dayOfWeek,
    timezone,
    timezoneLabel,
    locationName,
    iso: now.toISOString(),
    timestampMs: now.getTime(),
    formattedText,
    formattedHindi,
    formattedTelugu,
  };
}

/**
 * Generates a prompt-safe clock stamp to anchor AI sessions in verified reality.
 */
export function formatClockContext(userTimezone?: string, userLocationName?: string): string {
  const dt = getCurrentDateTime(userTimezone, userLocationName);
  return `[Verified System Clock: ${dt.dayOfWeek}, ${dt.date}, ${dt.timeShort} | Location: ${dt.locationName} | Timezone: ${dt.timezone} (${dt.timezoneLabel}) | ISO: ${dt.iso}]`;
}
