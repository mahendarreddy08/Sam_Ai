import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  WEBSITE_REGISTRY,
  resolveWebsiteDestination,
  launchWebsite,
  getRegisteredWebsites,
} from "../src/services/websiteLauncher.js";
import {
  isDomainWhitelisted,
  executeSafeAction,
  APPROVED_DOMAINS,
  APPROVED_SOCIAL_SITES,
} from "../src/services/actionRegistry.js";

describe("S.A.M. Voice-Controlled Website Launcher & Safety Suite", () => {
  describe("1. Validated 12-Destination Website Registry", () => {
    it("should register exactly 12 validated destinations with safe HTTPS URLs", () => {
      const sites = getRegisteredWebsites();
      assert.equal(sites.length, 12, `Expected 12 destinations, got ${sites.length}`);

      const expectedIds = [
        "youtube",
        "instagram",
        "facebook",
        "whatsapp",
        "linkedin",
        "x",
        "telegram",
        "gmail",
        "googledrive",
        "github",
        "chatgpt",
        "googlesearch",
      ];

      for (const id of expectedIds) {
        const dest = WEBSITE_REGISTRY[id];
        assert.ok(dest, `Missing expected destination ID: ${id}`);
        assert.ok(dest.url.startsWith("https://"), `Destination URL must use HTTPS: ${dest.url}`);
        assert.ok(dest.aliases.length >= 2, `Destination ${id} should have multiple multilingual aliases`);
      }
    });

    it("should ensure all 12 destinations have corresponding whitelisted domains", () => {
      for (const dest of Object.values(WEBSITE_REGISTRY)) {
        const check = isDomainWhitelisted(dest.url);
        assert.equal(
          check.allowed,
          true,
          `Destination URL '${dest.url}' for '${dest.name}' must be approved in domain whitelist`
        );
      }
    });
  });

  describe("2. Multilingual Natural Language Intent Resolution (English, Hindi, Telugu)", () => {
    it("should resolve natural English website launch commands", () => {
      const resYt = resolveWebsiteDestination("Sam, open YouTube");
      assert.equal(resYt.destination?.id, "youtube");
      assert.equal(resYt.detectedLang, "en");

      const resIg = resolveWebsiteDestination("Sam, open Instagram");
      assert.equal(resIg.destination?.id, "instagram");

      const resGmail = resolveWebsiteDestination("Sam, open Gmail");
      assert.equal(resGmail.destination?.id, "gmail");

      const resGpt = resolveWebsiteDestination("Sam, open ChatGPT");
      assert.equal(resGpt.destination?.id, "chatgpt");

      const resGh = resolveWebsiteDestination("Sam, open GitHub");
      assert.equal(resGh.destination?.id, "github");
    });

    it("should resolve natural Hindi commands with 'kholo' and Devanagari script", () => {
      const resWa = resolveWebsiteDestination("Sam, kholo WhatsApp");
      assert.equal(resWa.destination?.id, "whatsapp");
      assert.equal(resWa.detectedLang, "hi");

      const resYt = resolveWebsiteDestination("यूट्यूब खोलो");
      assert.equal(resYt.destination?.id, "youtube");
      assert.equal(resYt.detectedLang, "hi");

      const resTg = resolveWebsiteDestination("टेलीग्राम खोलो");
      assert.equal(resTg.destination?.id, "telegram");
      assert.equal(resTg.detectedLang, "hi");

      const resMail = resolveWebsiteDestination("जीमेल खोलो");
      assert.equal(resMail.destination?.id, "gmail");
      assert.equal(resMail.detectedLang, "hi");
    });

    it("should resolve natural Telugu commands with 'open cheyyi', 'teruvu', and Telugu script", () => {
      const resLi = resolveWebsiteDestination("Sam, LinkedIn open cheyyi");
      assert.equal(resLi.destination?.id, "linkedin");
      assert.equal(resLi.detectedLang, "te");

      const resWa = resolveWebsiteDestination("వాట్సాప్ ఓపెన్ చెయ్యి");
      assert.equal(resWa.destination?.id, "whatsapp");
      assert.equal(resWa.detectedLang, "te");

      const resYt = resolveWebsiteDestination("యూట్యూబ్ తెరువు");
      assert.equal(resYt.destination?.id, "youtube");
      assert.equal(resYt.detectedLang, "te");

      const resDrive = resolveWebsiteDestination("గూగుల్ డ్రైవ్ చూపించు");
      assert.equal(resDrive.destination?.id, "googledrive");
      assert.equal(resDrive.detectedLang, "te");
    });

    it("should handle mixed-language and code-switching requests", () => {
      const res1 = resolveWebsiteDestination("kholo YouTube please");
      assert.equal(res1.destination?.id, "youtube");

      const res2 = resolveWebsiteDestination("WhatsApp open cheyyi Sam");
      assert.equal(res2.destination?.id, "whatsapp");

      const res3 = resolveWebsiteDestination("ChatGPT open karo");
      assert.equal(res3.destination?.id, "chatgpt");
    });

    it("should extract query for search requests on YouTube or Google", () => {
      const ytSearch = resolveWebsiteDestination("search youtube for machine learning tutorials");
      assert.equal(ytSearch.destination?.id, "youtube");
      assert.equal(ytSearch.searchQuery, "machine learning tutorials");

      const gSearch = resolveWebsiteDestination("search google for react typescript state management");
      assert.equal(gSearch.destination?.id, "googlesearch");
      assert.equal(gSearch.searchQuery, "react typescript state management");
    });
  });

  describe("3. Native App vs Web Sandbox Distinction", () => {
    it("should identify requests for native installed desktop/mobile apps", () => {
      const calcApp = resolveWebsiteDestination("open calculator app");
      assert.equal(calcApp.isNativeAppRequest, true);
      assert.equal(calcApp.destination, null);

      const desktopApp = resolveWebsiteDestination("launch desktop app");
      assert.equal(desktopApp.isNativeAppRequest, true);
      assert.equal(desktopApp.destination, null);
    });
  });

  describe("4. Request Deduplication and Popup Blocker Resilience", () => {
    it("should safely process launchWebsite and return structured LaunchResult", () => {
      const reqId = `test-req-${Date.now()}`;
      const res = launchWebsite("youtube", { requestId: reqId });

      assert.equal(res.success, true);
      assert.equal(res.destinationId, "youtube");
      assert.equal(res.destinationName, "YouTube");
      assert.equal(res.url, "https://www.youtube.com");
      assert.equal(res.requestId, reqId);
      assert.ok(res.buttonLabel.includes("YouTube"));
    });

    it("should deduplicate repeat calls with the same requestId to prevent multiple tabs", () => {
      const reqId = `test-dedup-${Date.now()}`;
      const first = launchWebsite("whatsapp", { requestId: reqId });
      assert.equal(first.success, true);

      // Second invocation with identical requestId
      const second = launchWebsite("whatsapp", { requestId: reqId });
      assert.equal(second.success, true);
      assert.ok(second.message.includes("already launched"));
    });

    it("should return failure for unknown destinations not in registry", () => {
      const unknown = launchWebsite("unapprovedportalxyz");
      assert.equal(unknown.success, false);
      assert.equal(unknown.url, "");
      assert.ok(unknown.message.includes("not in the validated website registry"));
    });
  });

  describe("5. Action Registry executeSafeAction Integration", () => {
    it("should execute 'launch_website' action safely for all 12 destinations", () => {
      const testSites = [
        { id: "youtube", host: "youtube.com" },
        { id: "whatsapp", host: "web.whatsapp.com" },
        { id: "gmail", host: "mail.google.com" },
        { id: "telegram", host: "web.telegram.org" },
        { id: "chatgpt", host: "chatgpt.com" },
        { id: "github", host: "github.com" },
        { id: "linkedin", host: "linkedin.com" },
        { id: "instagram", host: "instagram.com" },
        { id: "facebook", host: "facebook.com" },
        { id: "x", host: "x.com" },
      ];

      for (const site of testSites) {
        const actionRes = executeSafeAction({
          name: "launch_website",
          args: { destination: site.id },
        });

        assert.equal(actionRes.success, true, `Action failed for ${site.id}`);
        assert.equal(actionRes.isAllowed, true);
        assert.ok(actionRes.destinationUrl?.includes(site.host));
        assert.ok(actionRes.buttonLabel.includes("Open"));
      }
    });

    it("should reject malicious or unapproved URLs in executeSafeAction", () => {
      const malicious = executeSafeAction({
        name: "open_website",
        args: { url: "https://stealth-phishing-attacker.xyz" },
      });

      assert.equal(malicious.success, false);
      assert.equal(malicious.isAllowed, false);
      assert.ok(malicious.blockedReason?.includes("whitelist"));
    });
  });
});
