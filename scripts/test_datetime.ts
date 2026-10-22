// scripts/test_datetime.ts - Automated Verification of DateTime Tool and Timezone Engine
import { getCurrentDateTime, resolveTimezone, formatClockContext } from "../src/utils/datetime.js";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log("=== Running DateTime & Timezone Formatting Tests ===\n");

// Test 1: Timezone Resolution & Fallbacks
assert(resolveTimezone("Asia/Kolkata") === "Asia/Kolkata", "Preserves valid Asia/Kolkata");
assert(resolveTimezone("America/New_York") === "America/New_York", "Preserves valid America/New_York");
assert(resolveTimezone("Europe/London") === "Europe/London", "Preserves valid Europe/London");
assert(resolveTimezone("Asia/Tokyo") === "Asia/Tokyo", "Preserves valid Asia/Tokyo");
assert(resolveTimezone("") === "Asia/Kolkata", "Empty string falls back to Asia/Kolkata");
assert(resolveTimezone(undefined) === "Asia/Kolkata", "Undefined falls back to Asia/Kolkata");
assert(resolveTimezone("auto") === "Asia/Kolkata", "'auto' falls back to Asia/Kolkata");
assert(resolveTimezone("Invalid/Zone_Name_123") === "Asia/Kolkata", "Invalid timezone falls back safely to Asia/Kolkata");

// Test 2: Real Runtime Clock in Asia/Kolkata
const kolkata = getCurrentDateTime("Asia/Kolkata");
assert(kolkata.timezone === "Asia/Kolkata", "Timezone matches Asia/Kolkata");
assert(kolkata.date.length > 5, "Date string is populated");
assert(kolkata.time.length > 3, "Time string is populated");
assert(kolkata.timeShort.length > 3, "TimeShort string is populated");
assert(kolkata.time24.length === 8, "Time24 matches HH:mm:ss format");
assert(kolkata.dayOfWeek.length > 2, "Day of week is populated");
assert(!isNaN(Date.parse(kolkata.iso)), "ISO format is a valid parseable date");
assert(kolkata.timestampMs > 1700000000000, "Timestamp in ms is a realistic epoch time");
assert(kolkata.formattedText.includes("Asia/Kolkata"), "English formattedText includes timezone name");
assert(kolkata.formattedHindi.includes("Asia/Kolkata"), "Hindi formattedHindi includes timezone name");
assert(kolkata.formattedTelugu.includes("Asia/Kolkata"), "Telugu formattedTelugu includes timezone name");

// Test 3: Consistency across Timezones
const ny = getCurrentDateTime("America/New_York");
const tokyo = getCurrentDateTime("Asia/Tokyo");
assert(ny.timezone === "America/New_York", "New York timezone set");
assert(tokyo.timezone === "Asia/Tokyo", "Tokyo timezone set");
assert(ny.timestampMs === tokyo.timestampMs || Math.abs(ny.timestampMs - tokyo.timestampMs) < 100, "Underlying UTC epoch is identical across timezones");

// Test 4: Clock Context String for Model Anchoring
const clockContext = formatClockContext("Asia/Kolkata");
assert(clockContext.startsWith("[Verified System Clock:"), "Clock context is properly formatted for prompt injection");
assert(clockContext.includes("Asia/Kolkata"), "Clock context contains user timezone");

console.log("\nSample Output for Asia/Kolkata:");
console.log(JSON.stringify(kolkata, null, 2));

console.log("\n🎉 ALL DATETIME TESTS PASSED SUCCESSFULLY!");
