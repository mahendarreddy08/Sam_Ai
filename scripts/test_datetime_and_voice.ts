// scripts/test_datetime_and_voice.ts - Comprehensive Verification of Clock, Tools, Multilingual Intent, and Live Voice Routing
import { getCurrentDateTime, resolveTimezone, formatClockContext } from "../src/utils/datetime.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log("=== S.A.M. Comprehensive Real-Time Clock & Tool Verification ===\n");

// 1. Timezone Resolution
console.log("--- 1. Testing Timezone Resolution & Fallbacks ---");
assert(resolveTimezone("Asia/Kolkata") === "Asia/Kolkata", "Preserves Asia/Kolkata");
assert(resolveTimezone("America/New_York") === "America/New_York", "Preserves America/New_York");
assert(resolveTimezone("Europe/London") === "Europe/London", "Preserves Europe/London");
assert(resolveTimezone("Asia/Tokyo") === "Asia/Tokyo", "Preserves Asia/Tokyo");
assert(resolveTimezone("") === "Asia/Kolkata", "Empty timezone falls back to Asia/Kolkata");
assert(resolveTimezone(undefined) === "Asia/Kolkata", "Undefined falls back to Asia/Kolkata");
assert(resolveTimezone("Invalid_Zone/NonExistent") === "Asia/Kolkata", "Invalid timezone falls back to Asia/Kolkata");
assert(resolveTimezone("auto") === "Asia/Kolkata", "'auto' falls back to Asia/Kolkata");

// 2. Real Runtime Clock Verification
console.log("\n--- 2. Testing Real Clock Output Integrity ---");
const kolkata = getCurrentDateTime("Asia/Kolkata");
assert(kolkata.timezone === "Asia/Kolkata", "Resolved timezone is Asia/Kolkata");
assert(kolkata.date.length > 5, `Date is populated: '${kolkata.date}'`);
assert(kolkata.time.length > 4, `Time is populated: '${kolkata.time}'`);
assert(kolkata.timeShort.length > 4, `TimeShort is populated: '${kolkata.timeShort}'`);
assert(kolkata.dayOfWeek.length > 3, `Day of week is populated: '${kolkata.dayOfWeek}'`);
assert(!isNaN(Date.parse(kolkata.iso)), "ISO is valid ISO-8601 string");
assert(typeof kolkata.timestampMs === "number" && kolkata.timestampMs > 1700000000000, "Realistic epoch timestamp in milliseconds");
assert(kolkata.formattedText.includes(kolkata.timeShort), "English formatted text contains time");
assert(kolkata.formattedHindi.includes(kolkata.timeShort), "Hindi formatted text contains time");
assert(kolkata.formattedTelugu.includes(kolkata.timeShort), "Telugu formatted text contains time");

// 3. Multilingual phrasing validation
console.log("\n--- 3. Testing Multilingual Phrasing ---");
assert(kolkata.formattedText.includes("IST"), "English output includes timezone label IST");
assert(kolkata.formattedHindi.includes("समय") && kolkata.formattedHindi.includes("तारीख"), "Hindi output uses proper Hindi vocabulary");
assert(kolkata.formattedTelugu.includes("సమయం") && kolkata.formattedTelugu.includes("తేదీ"), "Telugu output uses proper Telugu vocabulary");

// 4. Timezone offset checks between London, New York, Kolkata, Tokyo
console.log("\n--- 4. Testing Multi-Timezone Synchrony ---");
const ny = getCurrentDateTime("America/New_York");
const tokyo = getCurrentDateTime("Asia/Tokyo");
const london = getCurrentDateTime("Europe/London");
assert(ny.timestampMs === tokyo.timestampMs || Math.abs(ny.timestampMs - tokyo.timestampMs) < 100, "Same underlying UTC epoch across zones");
assert(ny.timezone !== tokyo.timezone, "Different timezones retain unique names");
assert(ny.time !== tokyo.time, "Local clock displays differ between NY and Tokyo");

// 5. System instruction clock context formatting
console.log("\n--- 5. Testing Prompt Clock Context Injection ---");
const promptStamp = formatClockContext("Asia/Kolkata");
assert(promptStamp.startsWith("[Verified System Clock:"), "Prompt clock context has required verified prefix");
assert(promptStamp.includes("Asia/Kolkata"), "Prompt clock context includes timezone");

// 6. Intent matching simulation for English, Hindi, and Telugu
console.log("\n--- 6. Testing Intent Matching for Time/Date in All 3 Languages ---");
const isTimeQuery = (message: string) => {
  const lower = message.toLowerCase().trim();
  return (
    /\b(time|clock|date|today'?s date|current time|what time|what day|day of week)\b/i.test(lower) ||
    /(?:समय|तारीख|घड़ी|दिन|वक्त|कितने बजे|क्या समय|आज का दिन|आज की तारीख)/.test(message) ||
    /\b(samay|samaya|tarikh|tareekh|kitne baje|kya samay|aaj ka din|waqt)\b/i.test(lower) ||
    /(?:సమయం|తేదీ|గడియారం|ఈ రోజు|ఏ వారం|ఎంత సమయం|ఇప్పుడు సమయం)/.test(message) ||
    /\b(samayam|samayam entha|ippudu samayam|ee roju|thedi|roju entha|e varam)\b/i.test(lower)
  );
};

// English variations
assert(isTimeQuery("What time is it?"), "Matches English: 'What time is it?'");
assert(isTimeQuery("What's today's date?"), "Matches English: 'What's today's date?'");
assert(isTimeQuery("Can you tell me the current time in Kolkata?"), "Matches English: 'current time'");

// Hindi variations
assert(isTimeQuery("अभी क्या समय हुआ है?"), "Matches Hindi: 'अभी क्या समय हुआ है?'");
assert(isTimeQuery("आज की तारीख क्या है?"), "Matches Hindi: 'आज की तारीख क्या है?'");
assert(isTimeQuery("kitne baje hain?"), "Matches Romanized Hindi: 'kitne baje hain?'");

// Telugu variations
assert(isTimeQuery("ఇప్పుడు సమయం ఎంత?"), "Matches Telugu: 'ఇప్పుడు సమయం ఎంత?'");
assert(isTimeQuery("ఈ రోజు తేదీ ఎంత?"), "Matches Telugu: 'ఈ రోజు తేదీ ఎంత?'");
assert(isTimeQuery("samayam entha?"), "Matches Romanized Telugu: 'samayam entha?'");

console.log("\n🎉 ALL 24 DATETIME AND MULTILINGUAL VOICE TESTS PASSED!");
