import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import {
  chunkText,
  cosineSimilarity,
  generateDeterministicEmbedding,
  RagKnowledgeBase,
} from "../src/services/ragService.js";
import {
  isDomainWhitelisted,
  executeSafeAction,
  sanitizeUrl,
  APPROVED_DOMAINS,
  APPROVED_SOCIAL_SITES,
} from "../src/services/actionRegistry.js";

describe("S.A.M. Phase 3 & 6: RAG Knowledge & Safe Action Verification Suite", () => {
  describe("1. Real Document Chunking & Text Segmentation (Phase 3)", () => {
    it("should split long text into overlapping chunks with word boundary preservation", () => {
      const longText = Array.from({ length: 250 }, (_, i) => `word${i}`).join(" ");
      const chunks = chunkText(longText, 100, 20);

      assert.ok(chunks.length >= 3, `Expected at least 3 chunks, got ${chunks.length}`);
      // Verify words per chunk
      const firstChunkWords = chunks[0].split(/\s+/).length;
      assert.equal(firstChunkWords, 100);

      // Verify overlap: words at the end of chunk 0 should appear at start of chunk 1
      const chunk0Words = chunks[0].split(/\s+/);
      const chunk1Words = chunks[1].split(/\s+/);
      const overlapWord = chunk0Words[chunk0Words.length - 1];
      assert.ok(chunk1Words.includes(overlapWord), "Expected overlap between consecutive chunks");
    });

    it("should handle short text as a single pristine chunk without unnecessary splits", () => {
      const shortText = "S.A.M. is an intelligent voice assistant.";
      const chunks = chunkText(shortText, 100, 20);
      assert.equal(chunks.length, 1);
      assert.equal(chunks[0], shortText);
    });

    it("should return an empty array for empty or whitespace-only inputs", () => {
      assert.deepEqual(chunkText(""), []);
      assert.deepEqual(chunkText("   \n\t  "), []);
    });
  });

  describe("2. Cosine Similarity & Vector Math (Phase 3)", () => {
    it("should return 1.0 for identical vectors", () => {
      const vec = [0.5, 0.5, 0.5, 0.5];
      const similarity = cosineSimilarity(vec, vec);
      assert.ok(Math.abs(similarity - 1.0) < 0.0001, `Expected 1.0, got ${similarity}`);
    });

    it("should return 0.0 for orthogonal vectors", () => {
      const vecA = [1, 0, 0];
      const vecB = [0, 1, 0];
      const similarity = cosineSimilarity(vecA, vecB);
      assert.equal(similarity, 0.0);
    });

    it("should handle empty or zero vectors safely without NaN or division by zero", () => {
      assert.equal(cosineSimilarity([], []), 0);
      assert.equal(cosineSimilarity([0, 0, 0], [0, 0, 0]), 0);
      assert.equal(cosineSimilarity([1, 2, 3], []), 0);
    });

    it("should generate normalized deterministic unit vectors", () => {
      const vec = generateDeterministicEmbedding("Machine learning in Python");
      assert.equal(vec.length, 128);
      // Unit length check: sum of squares should equal 1.0
      const normSquared = vec.reduce((sum, v) => sum + v * v, 0);
      assert.ok(Math.abs(normSquared - 1.0) < 0.001, `Expected unit norm, got ${normSquared}`);
    });
  });

  describe("3. RAG Semantic Knowledge Ingestion & Retrieval (Phase 3)", () => {
    let rag: RagKnowledgeBase;

    before(() => {
      rag = new RagKnowledgeBase();
    });

    it("should initialize with default project system documentation seeded", () => {
      const docs = rag.listDocuments();
      assert.ok(docs.length >= 3, `Expected at least 3 seed documents, got ${docs.length}`);
      assert.ok(rag.totalChunks() >= 3, "Expected multiple indexed chunks");

      const titles = docs.map((d) => d.title);
      assert.ok(titles.some((t) => t.includes("Architecture")));
      assert.ok(titles.some((t) => t.includes("Action Registry")));
      assert.ok(titles.some((t) => t.includes("Multilingual")));
    });

    it("should successfully retrieve relevant project knowledge with high cosine similarity", async () => {
      const results = await rag.query("What is the architecture and model behind SAM?", 3, 0.15);
      assert.ok(results.length > 0, "Expected at least 1 relevant chunk");

      const topResult = results[0];
      assert.ok(topResult.score >= 0.15, `Score should be significant, got ${topResult.score}`);
      assert.ok(topResult.docTitle.includes("Architecture"), `Expected Architecture doc, got ${topResult.docTitle}`);
      assert.ok(topResult.text.includes("gemini-3.8-flash") || topResult.text.includes("Express"));
    });

    it("should retrieve safe action policy for whitelist queries", async () => {
      const results = await rag.query("What is the domain whitelist and action safety protocol?", 2, 0.30);
      assert.ok(results.length > 0);
      const top = results[0];
      assert.ok(top.docTitle.includes("Action Registry"));
      assert.ok(top.text.includes("whitelist"));
    });

    it("should allow dynamic document ingestion, indexing, and retrieval", async () => {
      const newDoc = await rag.ingestDocument({
        id: "doc-test-exam",
        title: "CS50 Final Project Guidelines",
        content:
          "The CS50 final project requires a full-stack web application with responsive UI, secure API integration, automated testing, and comprehensive documentation of known limitations and deployment steps.",
        tags: ["course", "cs50"],
      });

      assert.equal(newDoc.title, "CS50 Final Project Guidelines");
      assert.ok(newDoc.chunkCount >= 1);

      const results = await rag.query("What are the final project requirements for CS50?", 2, 0.30);
      assert.ok(results.length > 0);
      assert.equal(results[0].docTitle, "CS50 Final Project Guidelines");
      assert.ok(results[0].text.includes("full-stack web application"));

      // Clean up test document
      const deleted = rag.deleteDocument("doc-test-exam");
      assert.equal(deleted, true);
    });

    it("should return empty results when query has no matching evidence above threshold", async () => {
      const results = await rag.query("Quantum chromodynamics gluonic flux tube topology", 3, 0.85);
      assert.equal(results.length, 0, "Irrelevant query with high threshold should yield 0 results");
    });
  });

  describe("4. Controlled Safe Action Registry & Whitelist Defense (Phase 6)", () => {
    it("should allow approved domains in whitelist", () => {
      assert.equal(isDomainWhitelisted("https://www.youtube.com").allowed, true);
      assert.equal(isDomainWhitelisted("https://google.com").allowed, true);
      assert.equal(isDomainWhitelisted("https://instagram.com").allowed, true);
      assert.equal(isDomainWhitelisted("https://github.com/google").allowed, true);
      assert.equal(isDomainWhitelisted("https://en.wikipedia.org/wiki/AI").allowed, true);
      assert.equal(isDomainWhitelisted("https://reddit.com/r/technology").allowed, true);
      assert.equal(isDomainWhitelisted("https://news.ycombinator.com").allowed, true);
    });

    it("should block unapproved domains and suspicious destinations", () => {
      const check1 = isDomainWhitelisted("https://malicious-phishing-site.xyz/login");
      assert.equal(check1.allowed, false);
      assert.ok(check1.error?.includes("whitelist"));

      const check2 = isDomainWhitelisted("https://unapproved-crypto-tracker.net");
      assert.equal(check2.allowed, false);
    });

    it("should strictly reject non-HTTP protocols (e.g. javascript:, file:, data:)", () => {
      assert.equal(isDomainWhitelisted("javascript:alert(1)").allowed, false);
      assert.equal(isDomainWhitelisted("file:///etc/passwd").allowed, false);
      assert.equal(isDomainWhitelisted("data:text/html,<script>evil()</script>").allowed, false);
    });

    it("should correctly execute 'open_youtube' action with and without query", () => {
      const homeAction = executeSafeAction({ name: "open_youtube", args: {} });
      assert.equal(homeAction.success, true);
      assert.equal(homeAction.destinationUrl, "https://www.youtube.com");
      assert.equal(homeAction.isAllowed, true);
      assert.equal(homeAction.buttonLabel, "Open YouTube ↗");

      const queryAction = executeSafeAction({
        name: "open_youtube",
        args: { query: "Python machine learning" },
      });
      assert.equal(queryAction.success, true);
      assert.ok(queryAction.destinationUrl?.includes("results?search_query=Python%20machine%20learning"));
      assert.ok(queryAction.buttonLabel.includes("Python machine learning"));
    });

    it("should correctly execute 'search_google' action with proper URL encoding", () => {
      const searchAction = executeSafeAction({
        name: "search_google",
        args: { query: "Python tutorials & guides" },
      });
      assert.equal(searchAction.success, true);
      assert.equal(searchAction.destinationUrl, "https://www.google.com/search?q=Python%20tutorials%20%26%20guides");
      assert.equal(searchAction.isAllowed, true);
      assert.equal(searchAction.domain, "google.com");
    });

    it("should correctly execute 'open_social_site' action for supported platforms", () => {
      const ig = executeSafeAction({ name: "open_social_site", args: { site: "instagram" } });
      assert.equal(ig.success, true);
      assert.equal(ig.destinationUrl, "https://www.instagram.com");

      const gh = executeSafeAction({ name: "open_social_site", args: { site: "github" } });
      assert.equal(gh.success, true);
      assert.equal(gh.destinationUrl, "https://github.com");

      const fb = executeSafeAction({ name: "open_social_site", args: { site: "facebook" } });
      assert.equal(fb.success, true);
      assert.equal(fb.destinationUrl, "https://www.facebook.com");
    });

    it("should reject unsupported social sites safely", () => {
      const unsupported = executeSafeAction({ name: "open_social_site", args: { site: "tiktok" } });
      assert.equal(unsupported.success, false);
      assert.equal(unsupported.isAllowed, false);
      assert.ok(unsupported.blockedReason?.includes("not supported"));
    });

    it("should reject unapproved website in 'open_website' with safe fallback card data", () => {
      const blocked = executeSafeAction({
        name: "open_website",
        args: { url: "https://unauthorized-portal.cc/download" },
      });
      assert.equal(blocked.success, false);
      assert.equal(blocked.isAllowed, false);
      assert.equal(blocked.buttonLabel, "Access Blocked");
      assert.ok(blocked.description.includes("whitelist"));
    });
  });

  describe("5. URL Sanitization and Formatting", () => {
    it("should auto-prefix https:// to naked hostnames", () => {
      assert.equal(sanitizeUrl("github.com/google"), "https://github.com/google");
      assert.equal(sanitizeUrl("  youtube.com  "), "https://youtube.com");
    });

    it("should preserve existing https:// protocol", () => {
      assert.equal(sanitizeUrl("https://en.wikipedia.org"), "https://en.wikipedia.org");
    });
  });
});
