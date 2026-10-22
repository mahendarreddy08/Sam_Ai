/**
 * S.A.M. Real Retrieval-Augmented Generation (RAG) Service
 * Implements chunking, semantic vector indexing, cosine similarity ranking,
 * and source-attributed context generation for project knowledge.
 */

export interface RagDocument {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  chunkCount: number;
}

export interface RagChunk {
  id: string;
  docId: string;
  docTitle: string;
  chunkIndex: number;
  text: string;
  embedding?: number[];
}

export interface RagQueryResult {
  chunkId: string;
  docId: string;
  docTitle: string;
  text: string;
  score: number;
}

/**
 * Split text into semantic chunks with word boundaries and overlap.
 * Default: ~80-150 words per chunk with 20-word overlap for high semantic coherence.
 */
export function chunkText(text: string, chunkSizeWords: number = 100, overlapWords: number = 20): string[] {
  if (!text || !text.trim()) return [];
  const words = text.trim().split(/\s+/);
  if (words.length <= chunkSizeWords) {
    return [words.join(" ")];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + chunkSizeWords, words.length);
    // If the remaining words after this chunk would be a tiny stub (< 30 words), include them in this chunk
    if (words.length - endIndex > 0 && words.length - endIndex < 30) {
      chunks.push(words.slice(startIndex).join(" "));
      break;
    }

    chunks.push(words.slice(startIndex, endIndex).join(" "));

    if (endIndex >= words.length) break;
    startIndex += chunkSizeWords - overlapWords;
  }

  return chunks;
}

/**
 * Light suffix stemming for English tokens to improve semantic recall on inflected terms (e.g. models -> model).
 */
function stemToken(word: string): string {
  let w = word.toLowerCase();
  if (w.endsWith("ies") && w.length > 4) return w.slice(0, -3) + "y";
  if (w.endsWith("ing") && w.length > 5) return w.slice(0, -3);
  if (w.endsWith("ed") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("es") && w.length > 4) return w.slice(0, -2);
  if (w.endsWith("s") && !w.endsWith("ss") && w.length > 3) return w.slice(0, -1);
  return w;
}

/**
 * Compute cosine similarity between two dense numerical vectors.
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (!vecA || !vecB || vecA.length === 0 || vecB.length === 0) return 0;
  const len = Math.min(vecA.length, vecB.length);
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < len; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }

  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  return dotProduct / denominator;
}

/**
 * Fallback semantic hash/frequency embedding generator when offline or in test environments.
 * Generates normalized 128-dimensional dense vector from text tokens.
 */
export function generateDeterministicEmbedding(text: string, dimensions: number = 128): number[] {
  const vec = new Array(dimensions).fill(0);
  const normalized = text.toLowerCase().replace(/s\.a\.m\.?/g, "sam").replace(/[^a-z0-9\s]/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  if (words.length === 0) return vec;

  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "what", "in", "on", "at",
    "for", "and", "to", "of", "with", "this", "that", "it", "as", "by",
    "or", "from", "about", "behind", "how", "why", "which", "do", "does", "did", "be", "been"
  ]);

  for (const rawWord of words) {
    const isStop = stopWords.has(rawWord);
    const word = stemToken(rawWord);
    const weight = isStop ? 0.05 : 1.0;
    let hash = 0;
    for (let i = 0; i < word.length; i++) {
      hash = (hash << 5) - hash + word.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % dimensions;
    vec[idx] += weight;
    // Secondary hash for dispersion
    const idx2 = Math.abs((hash * 31) | 0) % dimensions;
    vec[idx2] += weight * 0.5;
  }

  // Normalize to unit vector
  let norm = 0;
  for (let i = 0; i < dimensions; i++) {
    norm += vec[i] * vec[i];
  }
  const mag = Math.sqrt(norm);
  if (mag > 0) {
    for (let i = 0; i < dimensions; i++) {
      vec[i] = vec[i] / mag;
    }
  }

  return vec;
}

export class RagKnowledgeBase {
  private documents: Map<string, RagDocument> = new Map();
  private chunks: RagChunk[] = [];
  private embedFn?: (text: string) => Promise<number[]>;

  constructor(embedFn?: (text: string) => Promise<number[]>) {
    this.embedFn = embedFn;
    this.seedDefaultKnowledge();
  }

  public setEmbedFn(fn: (text: string) => Promise<number[]>) {
    this.embedFn = fn;
  }

  /**
   * Seed core project knowledge so S.A.M. can immediately answer project-specific questions with real RAG.
   */
  private seedDefaultKnowledge() {
    this.ingestDocumentSync({
      id: "doc-sam-architecture",
      title: "S.A.M. Assistant Architecture & Specifications",
      tags: ["project", "architecture", "sam"],
      content: `S.A.M. (Synthetic Autonomous Mind) is an empathetic, multilingual personal voice assistant and productivity engine built for Google AI Studio.
It runs a full-stack architecture powered by Express on port 3000, Vite dev middleware with custom HMR stability, and Google Gemini models.
The primary conversational LLM is gemini-3.8-flash for high-speed multi-turn reasoning and math.
Real-time bidirectional audio is driven by gemini-3.8-live over a dedicated WebSocket at path /live with 16kHz PCM input and 24kHz output.
Speech synthesis uses gemini-3.8-flash-lite-tts with prebuilt voices (Zephyr, Puck, Charon, Kore, Fenrir, Aoede) and seamless browser Web Speech fallback.
Data persistence is handled by Firebase Firestore with offline-first localStorage replication and real-time cloud synchronization.`,
    });

    this.ingestDocumentSync({
      id: "doc-sam-actions",
      title: "S.A.M. Controlled Action Registry & Safety Protocol",
      tags: ["actions", "safety", "whitelist"],
      content: `S.A.M. includes a safe tool and action registry that executes approved user actions while preventing arbitrary code execution.
Approved actions include: open_website, search_google, open_youtube, and open_social_site (Instagram, Facebook, LinkedIn, GitHub, Reddit, Twitter/X).
All web destinations are strictly validated against an approved domain whitelist. Unapproved domains or malicious URL schemes (such as file://, javascript:, or unauthorized origins) are rejected.
Due to browser iframe security policies and pop-up blockers, actions generate verified clickable action cards with direct HTTPS links and fallback confirmation buttons.
Direct launching of native desktop or Android executables is prevented by web browser sandboxing; S.A.M. informs the user and provides the web-based equivalent.`,
    });

    this.ingestDocumentSync({
      id: "doc-sam-languages",
      title: "S.A.M. Multilingual Voice & Clock Guidelines",
      tags: ["multilingual", "telugu", "hindi", "clock"],
      content: `S.A.M. natively supports three languages: English, Hindi (हिन्दी), and Telugu (తెలుగు), including conversational code-switching.
For clock and time queries, the system uses the verified server clock in Asia/Kolkata timezone with default display location Hyderabad, Telangana, India.
Asia/Kolkata is strictly the technical IANA timezone standard for India Standard Time (IST) and is never reported as Kolkata city time for general queries.
Specific city time requests (e.g., Kolkata, New York, Tokyo) are computed dynamically via Intl.DateTimeFormat with verified offsets.`,
    });
  }

  public ingestDocumentSync(doc: { id?: string; title: string; content: string; tags?: string[] }): RagDocument {
    const docId = doc.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const textChunks = chunkText(doc.content);

    const docRecord: RagDocument = {
      id: docId,
      title: doc.title,
      content: doc.content,
      tags: doc.tags || [],
      createdAt: new Date().toISOString(),
      chunkCount: textChunks.length,
    };

    this.documents.set(docId, docRecord);

    textChunks.forEach((chunkStr, idx) => {
      const chunkId = `${docId}-chunk-${idx}`;
      const textToEmbed = `${doc.title}\n${chunkStr}`;
      const embedding = generateDeterministicEmbedding(textToEmbed);
      this.chunks.push({
        id: chunkId,
        docId,
        docTitle: doc.title,
        chunkIndex: idx,
        text: chunkStr,
        embedding,
      });
    });

    return docRecord;
  }

  public async ingestDocument(doc: { id?: string; title: string; content: string; tags?: string[] }): Promise<RagDocument> {
    const docId = doc.id || `doc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const textChunks = chunkText(doc.content);

    const docRecord: RagDocument = {
      id: docId,
      title: doc.title,
      content: doc.content,
      tags: doc.tags || [],
      createdAt: new Date().toISOString(),
      chunkCount: textChunks.length,
    };

    // Remove existing chunks if re-ingesting
    this.chunks = this.chunks.filter((c) => c.docId !== docId);
    this.documents.set(docId, docRecord);

    for (let idx = 0; idx < textChunks.length; idx++) {
      const chunkStr = textChunks[idx];
      const chunkId = `${docId}-chunk-${idx}`;
      const textToEmbed = `${doc.title}\n${chunkStr}`;
      let embedding: number[];

      if (this.embedFn) {
        try {
          embedding = await this.embedFn(textToEmbed);
        } catch (e) {
          console.warn(`[RAG] Fallback to deterministic embedding for chunk ${chunkId}:`, e);
          embedding = generateDeterministicEmbedding(textToEmbed);
        }
      } else {
        embedding = generateDeterministicEmbedding(textToEmbed);
      }

      this.chunks.push({
        id: chunkId,
        docId,
        docTitle: doc.title,
        chunkIndex: idx,
        text: chunkStr,
        embedding,
      });
    }

    return docRecord;
  }

  public async query(userQuery: string, topK: number = 3, minScore: number = 0.20): Promise<RagQueryResult[]> {
    if (!userQuery || !userQuery.trim() || this.chunks.length === 0) return [];

    let queryVec: number[];
    if (this.embedFn) {
      try {
        queryVec = await this.embedFn(userQuery);
      } catch {
        queryVec = generateDeterministicEmbedding(userQuery);
      }
    } else {
      queryVec = generateDeterministicEmbedding(userQuery);
    }

    const scored: RagQueryResult[] = this.chunks.map((chunk) => {
      const score = chunk.embedding ? cosineSimilarity(queryVec, chunk.embedding) : 0;
      return {
        chunkId: chunk.id,
        docId: chunk.docId,
        docTitle: chunk.docTitle,
        text: chunk.text,
        score: Math.round(score * 1000) / 1000,
      };
    });

    // Sort descending by score
    scored.sort((a, b) => b.score - a.score);

    // Return top-K that meet threshold
    return scored.filter((r) => r.score >= minScore).slice(0, topK);
  }

  public listDocuments(): RagDocument[] {
    return Array.from(this.documents.values());
  }

  public getDocument(id: string): RagDocument | undefined {
    return this.documents.get(id);
  }

  public deleteDocument(id: string): boolean {
    const deleted = this.documents.delete(id);
    if (deleted) {
      this.chunks = this.chunks.filter((c) => c.docId !== id);
    }
    return deleted;
  }

  public totalChunks(): number {
    return this.chunks.length;
  }

  public clear(): void {
    this.documents.clear();
    this.chunks = [];
  }
}
