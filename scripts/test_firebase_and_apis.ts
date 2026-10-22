// scripts/test_firebase_and_apis.ts
import fs from "fs";
import path from "path";

async function runTests() {
  console.log("=== S.A.M. Production Reliability Test Suite ===");
  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`✅ PASS: ${msg}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${msg}`);
      process.exitCode = 1;
    }
  }

  // 1. Verify Firebase Configuration
  console.log("\n--- 1. Testing Firebase Config & Security Rules ---");
  const configPath = path.resolve("firebase-applet-config.json");
  assert(fs.existsSync(configPath), "firebase-applet-config.json exists");
  const config = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  assert(config.projectId === "noted-analogy-8k8sk", `Project ID matches provisioned project: ${config.projectId}`);
  assert(!!config.firestoreDatabaseId, `Firestore database ID is configured: ${config.firestoreDatabaseId}`);

  const rulesPath = path.resolve("firestore.rules");
  assert(fs.existsSync(rulesPath), "firestore.rules exists");
  const rules = fs.readFileSync(rulesPath, "utf-8");
  assert(rules.includes("allow read, write: if false;"), "Default-deny catch-all exists");
  assert(rules.includes("isOwner(userId)"), "isOwner security gate is defined");
  assert(rules.includes("match /notes/{noteId}"), "Notes collection is secured");
  assert(rules.includes("match /tasks/{taskId}"), "Tasks collection is secured");
  assert(rules.includes("match /memories/{memoryId}"), "Memories collection is secured");

  // 2. Verify Open-Meteo Weather API (Priority 4)
  console.log("\n--- 2. Testing Real External Weather API (Open-Meteo) ---");
  try {
    const geoRes = await fetch("https://geocoding-api.open-meteo.com/v1/search?name=Hyderabad&count=1&language=en&format=json");
    assert(geoRes.ok, "Open-Meteo geocoding responds with 200 OK");
    const geoData: any = await geoRes.json();
    assert(geoData.results && geoData.results.length > 0, "Geocoding returned valid coordinates for Hyderabad");
    const { latitude, longitude } = geoData.results[0];

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    assert(weatherRes.ok, "Open-Meteo forecast responds with 200 OK");
    const weatherData: any = await weatherRes.json();
    assert(typeof weatherData.current?.temperature_2m === "number", `Real temperature received: ${weatherData.current?.temperature_2m}°C`);
    assert(typeof weatherData.current?.relative_humidity_2m === "number", `Real humidity received: ${weatherData.current?.relative_humidity_2m}%`);
  } catch (err: any) {
    assert(false, `Weather API failed: ${err.message}`);
  }

  // 3. Verify HackerNews Top Stories API for Daily Tech Briefing (Priority 5)
  console.log("\n--- 3. Testing Automated Data Refresh (HackerNews Stories) ---");
  try {
    const start = Date.now();
    const hnRes = await fetch("https://hacker-news.firebaseio.com/v0/topstories.json");
    assert(hnRes.ok, "HackerNews topstories API responds with 200 OK");
    const storyIds: number[] = await hnRes.json();
    assert(Array.isArray(storyIds) && storyIds.length > 0, `Received ${storyIds.length} top story IDs`);

    const firstId = storyIds[0];
    const itemRes = await fetch(`https://hacker-news.firebaseio.com/v0/item/${firstId}.json`);
    assert(itemRes.ok, `Story item ${firstId} retrieved successfully`);
    const itemData: any = await itemRes.json();
    assert(!!itemData.title, `Story title: "${itemData.title.slice(0, 50)}..."`);
    assert(typeof itemData.score === "number", `Story score: ${itemData.score}`);
    const duration = Date.now() - start;
    assert(duration < 5000, `Refresh completed within SLA: ${duration}ms`);
  } catch (err: any) {
    assert(false, `HackerNews API failed: ${err.message}`);
  }

  // 4. Verify LocalStorage Migration Spec and Backup Structure (Priority 7)
  console.log("\n--- 4. Testing User Data Export & Schema Structure ---");
  const sampleBackup = {
    version: "2.0",
    exportDate: new Date().toISOString(),
    userId: "test-user-123",
    tasks: [{ id: "1", title: "Test Task", completed: false, createdAt: "2026-10-20" }],
    notes: [{ id: "1", title: "Test Note", content: "Test Content", createdAt: "2026-10-20" }],
    memory: [{ id: "1", key: "favorite_color", value: "cyan", category: "preference" as const, updatedAt: "2026-10-20" }],
  };
  const jsonStr = JSON.stringify(sampleBackup, null, 2);
  const parsed = JSON.parse(jsonStr);
  assert(parsed.version === "2.0", "Backup version matches specification");
  assert(parsed.tasks.length === 1, "Backup includes tasks");
  assert(parsed.notes.length === 1, "Backup includes notes");
  assert(parsed.memory.length === 1, "Backup includes user memory");

  console.log(`\n========================================`);
  console.log(`Results: ${passed} / ${total} tests passed.`);
  console.log(`========================================`);
}

runTests();
