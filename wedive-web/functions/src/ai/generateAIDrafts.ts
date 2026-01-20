import { onCall } from "firebase-functions/v2/https";
import { VertexAI, Tool } from "@google-cloud/vertexai";
import { getFirestore } from "firebase-admin/firestore";
import { initializeApp, getApps } from "firebase-admin/app";
import * as logger from "firebase-functions/logger";

if (getApps().length === 0) {
  initializeApp();
}

const db = getFirestore();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Firestore Caching Logic
 */
async function getCachedGrounding(name: string, type: string) {
  const doc = await db.collection("ai_grounding_cache").doc(`${type}_${name}`).get();
  if (doc.exists) {
    const data = doc.data();
    if (data && Date.now() - data.timestamp < CACHE_TTL_MS) {
      if (data.result && data.result.description && data.result.description.length > 10) {
        return data.result;
      }
    }
  }
  return null;
}

async function setCachedGrounding(name: string, type: string, result: any) {
  await db.collection("ai_grounding_cache").doc(`${type}_${name}`).set({
    result,
    timestamp: Date.now()
  });
}


/**
 * Verification logic for grounding
 */
function shouldGround(draft: any, keywords: string[]): boolean {
  if (draft.needs_search) return true;

  const content = JSON.stringify(draft).toLowerCase();
  const region = (draft.region || "").toLowerCase();
  const description = (draft.description || "").toLowerCase();

  const isTemperate = region.includes("伊豆") || region.includes("日本海") || region.includes("千葉");
  const hasTropicalFeature = description.includes("サンゴ") || description.includes("トロピカル") || description.includes("透明度30");

  if (isTemperate && hasTropicalFeature) return true;

  const izuTerms = ["伊豆", "赤沢", "富戸", "大瀬崎", "海洋公園"];
  const isIzu = izuTerms.some(term => draft.region?.includes(term) || draft.name?.includes(term) || draft.area?.includes(term));
  if (isIzu && (content.includes("サンゴ礁") || content.includes("リーフ"))) return true;

  return keywords.some(k => content.includes(k.toLowerCase()));
}

const SPOT_KEYWORDS = ["サンゴ", "リーフ", "亀", "ウミガメ", "洞窟", "ドロップオフ", "沈没船", "遺跡", "歴史", "固有種", "透明度"];
const CREATURE_KEYWORDS = ["固有種", "絶滅危惧", "新種", "猛毒", "危険", "学名", "共生", "アジ", "サメ", "マンタ", "イソギンチャク", "クマノミ", "光沢", "色彩"];

/**
 * AI Spot Registration Assistant (with 2-Step Optimized Grounding)
 */
export const generateSpotDraft = onCall({
  region: "asia-northeast1",
  cors: ["https://wedive.app", "https://we-dive.web.app", "http://localhost:5173"]
}, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new Error("unauthenticated");

  const spotName = data.spotName;
  if (!spotName) throw new Error("missing-spot-name");

  const cached = await getCachedGrounding(spotName, "spot");
  if (cached) return cached;

  const useVertexSearch = process.env.ENABLE_V2_VERTEX_SEARCH === "true" || process.env.USE_VERTEX_AI_SEARCH === "true";
  const dataStoreIds = process.env.VERTEX_AI_DRAFT_DATA_STORE_IDS;
  const projectId = process.env.GCLOUD_PROJECT;

  const vertexAI = new VertexAI({ project: projectId, location: "us-central1" });

  // --- JSON Prompt Definitions (Schema Replacement) ---
  const spotJsonPrompt = `
You are a WeDive spot data manager.
Output MUST be a valid JSON object following this structure:
{
  "name": "string",
  "region": "string",
  "zone": "string",
  "area": "string",
  "level": "初級|中級|上級",
  "max_depth": number,
  "entry": "ビーチ|ボート|エントリー容易",
  "flow": "なし|弱|強|ドリフト",
  "terrain": ["string", ...],
  "latitude": number,
  "longitude": number,
  "description": "string",
  "tags": ["string", ...],
  "needs_search": boolean
}
Ensure all keys are present. If uncertain, set needs_search to true.
`;

  try {
    // --- Step 1: Internal Search (Managed RAG for WeDive data) ---
    const internalTools: Tool[] = [];
    if (useVertexSearch && dataStoreIds && projectId) {
      const ids = dataStoreIds.split(",").map(id => id.trim()).filter(id => id.length > 0);
      ids.forEach(id => {
        internalTools.push({
          vertexAiSearch: {
            datastore: `projects/${projectId}/locations/global/collections/default_collection/dataStores/${id}`
          }
        } as any);
      });
    }

    const modelInternal = vertexAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      tools: internalTools,
      systemInstruction: spotJsonPrompt
    });

    const resultInternal = await modelInternal.generateContent({
      contents: [{ role: "user", parts: [{ text: `「${spotName}」を調査してください。` }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    const draftText = resultInternal.response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!draftText) throw new Error("empty-ai-response");
    let finalResult = JSON.parse(draftText);

    // --- Step 2: Conditional Grounding (Google Search only when needed) ---
    if (shouldGround(finalResult, SPOT_KEYWORDS)) {
      logger.info(`Grounding required for spot: ${spotName}`);
      const modelGrounded = vertexAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        tools: [{ googleSearch: {} }] as any,
        systemInstruction: spotJsonPrompt + "\nUse Google Search to verify facts."
      });

      const resultGrounded = await modelGrounded.generateContent({
        contents: [{ role: "user", parts: [{ text: `「${spotName}」について、Google検索で事実確認を行いドラフトを完成させてください。` }] }],
        generationConfig: { responseMimeType: "application/json" }
      });

      const candidate = resultGrounded.response.candidates?.[0];
      const groundedText = candidate?.content?.parts?.[0]?.text;
      if (groundedText) {
        finalResult = JSON.parse(groundedText);
        const metadata = candidate?.groundingMetadata;
        const sources: string[] = [];
        metadata?.groundingChunks?.forEach((chunk: any) => {
          if (chunk.web?.uri) sources.push(chunk.web.uri);
          if (chunk.retrievalMetadata?.sourceMetadata?.uri) sources.push(chunk.retrievalMetadata.sourceMetadata.uri);
        });
        finalResult.is_verified = sources.length > 0;
        finalResult.sources = [...new Set(sources)];
        finalResult.grounding_evidence = { search_entry_point: metadata?.searchEntryPoint?.renderedContent || null, method: "hybrid-step2" };
      }
    } else {
      finalResult.is_verified = false;
      finalResult.grounding_evidence = { method: "internal-only" };
    }

    delete finalResult.needs_search;
    await setCachedGrounding(spotName, "spot", finalResult);
    return finalResult;

  } catch (error) {
    logger.error("AI Grounding Error (Spot):", error);
    throw new Error("generation-failed");
  }
});

/**
 * AI Creature Registration Assistant (with 2-Step Optimized Grounding)
 */
export const generateCreatureDraft = onCall({
  region: "asia-northeast1",
  cors: ["https://wedive.app", "https://we-dive.web.app", "http://localhost:5173"]
}, async (request) => {
  const { auth, data } = request;
  if (!auth) throw new Error("unauthenticated");

  const creatureName = data.creatureName;
  if (!creatureName) throw new Error("missing-name");

  const cached = await getCachedGrounding(creatureName, "creature");
  if (cached) return cached;

  const useVertexSearch = process.env.ENABLE_V2_VERTEX_SEARCH === "true" || process.env.USE_VERTEX_AI_SEARCH === "true";
  const dataStoreIds = process.env.VERTEX_AI_DRAFT_DATA_STORE_IDS;
  const projectId = process.env.GCLOUD_PROJECT;

  const vertexAI = new VertexAI({ project: projectId, location: "us-central1" });

  const creatureJsonPrompt = `
You are a marine biologist.
Output MUST be a valid JSON object following this structure:
{
  "name": "string",
  "scientific_name": "string",
  "category": "魚類|軟骨魚類|爬虫類|甲殻類|軟体動物|刺胞動物|哺乳類|その他",
  "rarity": "Common (★1)|Rare (★2)|Epic (★3)|Legendary (★4)",
  "description": "string",
  "size": "string (e.g. 30cm)",
  "depth_min": number (m),
  "depth_max": number (m),
  "seasons": ["春", "夏", "秋", "冬"],
  "special_traits": ["string", ...],
  "temp_min": number (℃),
  "temp_max": number (℃),
  "search_tags": ["string", ...],
  "needs_search": boolean
}
Ensure all keys are present.
`;

  try {
    // --- Step 1: Internal Search ---
    const internalTools: Tool[] = [];
    if (useVertexSearch && dataStoreIds && projectId) {
      const ids = dataStoreIds.split(",").map(id => id.trim()).filter(id => id.length > 0);
      ids.forEach(id => {
        internalTools.push({
          vertexAiSearch: {
            datastore: `projects/${projectId}/locations/global/collections/default_collection/dataStores/${id}`
          }
        } as any);
      });
    }

    const modelInternal = vertexAI.getGenerativeModel({
      model: "gemini-2.0-flash-exp",
      tools: internalTools,
      systemInstruction: creatureJsonPrompt + "\nUse internal datastores."
    });

    const resultInternal = await modelInternal.generateContent({
      contents: [{ role: "user", parts: [{ text: `「${creatureName}」について調査してください。` }] }],
      generationConfig: { responseMimeType: "application/json" }
    });

    logger.info("Step 1 Raw Response:", JSON.stringify(resultInternal.response)); // Debug Log

    let finalResult = JSON.parse(resultInternal.response.candidates?.[0]?.content?.parts?.[0]?.text || "{}");

    // --- Step 2: Conditional Grounding ---
    if (shouldGround(finalResult, CREATURE_KEYWORDS)) {
      logger.info(`Grounding required for creature: ${creatureName}`);
      const modelGrounded = vertexAI.getGenerativeModel({
        model: "gemini-2.0-flash-exp",
        tools: [{ googleSearch: {} }] as any,
        systemInstruction: creatureJsonPrompt + "\nUse Google Search to verify facts."
      });

      const resultGrounded = await modelGrounded.generateContent({
        contents: [{ role: "user", parts: [{ text: `「${creatureName}」についてGoogle検索で正確な情報を補完してください。` }] }],
        generationConfig: { responseMimeType: "application/json" }
      });

      logger.info("Step 2 Raw Response:", JSON.stringify(resultGrounded.response)); // Debug Log

      const candidate = resultGrounded.response.candidates?.[0];
      const groundedText = candidate?.content?.parts?.[0]?.text;
      if (groundedText) {
        finalResult = JSON.parse(groundedText);
        const metadata = candidate?.groundingMetadata;
        const sources: string[] = [];
        metadata?.groundingChunks?.forEach((chunk: any) => {
          if (chunk.web?.uri) sources.push(chunk.web.uri);
        });
        finalResult.is_verified = sources.length > 0;
        finalResult.sources = [...new Set(sources)];
        finalResult.grounding_evidence = { method: "hybrid-step2" };
      }
    } else {
      finalResult.is_verified = false;
      finalResult.grounding_evidence = { method: "internal-only" };
    }

    delete finalResult.needs_search;
    await setCachedGrounding(creatureName, "creature", finalResult);
    return finalResult;

  } catch (error) {
    logger.error("AI Grounding Error (Creature):", error);
    throw new Error("generation-failed");
  }
});
