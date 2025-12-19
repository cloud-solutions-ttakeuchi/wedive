"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleansingEngine = void 0;
const vertexai_1 = require("@google-cloud/vertexai");
const logger = require("firebase-functions/logger");
/**
 * High-Precision Biological Mapping Engine (Issue #49)
 */
class CleansingEngine {
    constructor(projectId = "wedive-app", location = "us-central1") {
        this.vertexAI = new vertexai_1.VertexAI({ project: projectId, location });
        // Stage 1 Model: Gemini 1.5 Flash (Fast & Cheap for Filtering)
        this.modelFlash = this.vertexAI.getGenerativeModel({
            model: "gemini-1.5-flash-002",
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: vertexai_1.SchemaType.OBJECT,
                    properties: {
                        is_possible: { type: vertexai_1.SchemaType.BOOLEAN },
                        rarity: { type: vertexai_1.SchemaType.STRING, enum: ["Common", "Rare", "Epic", "Legendary"] },
                        confidence: { type: vertexai_1.SchemaType.NUMBER },
                        reasoning: { type: vertexai_1.SchemaType.STRING }
                    },
                    required: ["is_possible", "rarity", "confidence", "reasoning"]
                }
            }
        });
        // Stage 2 Model: Gemini 1.5 Flash (with Grounding)
        // Using Flash for grounding is cost-effective compared to Pro.
        this.modelGrounding = this.vertexAI.getGenerativeModel({
            model: "gemini-1.5-flash-002",
            tools: [
                { googleSearchRetrieval: {} }
            ]
        });
    }
    /**
     * Batch Point-Creature Mapping Verification (Optimized with System Instructions)
     */
    async verifyBatch(point, creatures) {
        try {
            // 生物リストをモデルの "知識" として System Instruction に載せることで
            // Vertex AI の Implicit Caching が効きやすくなり、コストが大幅に削減されます。
            const modelWithContext = this.vertexAI.getGenerativeModel({
                model: "gemini-1.5-flash-002",
                systemInstruction: `
          あなたは海洋生物学者およびダイビングガイドの専門家です。
          提供された生物リストの生態に基づき、特定のダイビングポイントに生息可能か、または実際に目撃例があるかを判断します。

          【生物辞書データ】
          ${creatures.map((c, i) => `ID:${c.id} - ${c.name}: ${c.description} (生息水深:${JSON.stringify(c.depthRange)})`).join('\n')}

          指示:
          1. 地形・水深・潮流の物理的制約を最優先に考慮してください。
          2. 地理的分布（日本なら伊豆、沖縄、日本海側など）の矛盾を指摘してください。
          3. 出力は必ず指定されたJSON配列形式のみで行ってください。
        `,
                generationConfig: {
                    responseMimeType: "application/json"
                }
            });
            const batchPrompt = `
        以下のポイント環境において、生息可能な生物を辞書から抽出してください。

        【ポイント: ${point.name}】
        エリア: ${point.area} (${point.region})
        最大水深: ${point.maxDepth}m
        地形: ${JSON.stringify(point.topography)}
        潮流: ${point.current}

        出力形式:
        [
          { "creatureId": "string", "is_possible": boolean, "rarity": "Common"|"Rare"|"Epic"|"Legendary", "confidence": float, "reasoning": "string" }
        ]
      `;
            const result = await modelWithContext.generateContent(batchPrompt);
            const candidates = result.response.candidates || [];
            if (candidates.length === 0)
                return [];
            const outputText = candidates[0].content.parts[0].text || "[]";
            const jsonMatch = outputText.match(/\[[\s\S]*\]/);
            const results1 = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
            const finalResults = [];
            for (const res of results1) {
                if (!res.is_possible || res.confidence < 0.4)
                    continue;
                const creature = creatures.find(c => c.id === res.creatureId);
                if (!creature)
                    continue;
                // --- Stage 2: Fact Verification ---
                const groundedMapping = await this.verifyMapping(point, creature, res);
                if (groundedMapping)
                    finalResults.push(groundedMapping);
            }
            return finalResults;
        }
        catch (error) {
            logger.error(`Batch cleansing failed for ${point.name}:`, error);
            return [];
        }
    }
    /**
     * Single Point-Creature Mapping Verification (Internal Stage 2)
     */
    async verifyMapping(point, creature, stage1Result) {
        try {
            // Stage 1 validation if not provided
            let s1 = stage1Result;
            if (!s1) {
                const stage1Prompt = `ポイント ${point.name} に生物 ${creature.name} は生息可能か？`; // Simplified for brevity
                const r1 = await this.modelFlash.generateContent(stage1Prompt);
                s1 = JSON.parse(r1.response.candidates[0].content.parts[0].text || '{"is_possible": false}');
            }
            if (!s1.is_possible)
                return null;
            // Stage 2: Fact Verification (Google Search Grounding)
            const groundingPrompt = `
        「${point.name}」（${point.region} ${point.area}）において、
        生物「${creature.name}」の目撃実績があるかGoogle検索で確認してください。
        回答は必ず以下のJSON形式で。
        {"actual_existence": boolean, "evidence": "string", "rarity": "Common"|"Rare"|"Epic"|"Legendary"}
      `;
            const result2 = await this.modelGrounding.generateContent(groundingPrompt);
            const text2 = result2.response.candidates[0].content.parts[0].text;
            const jsonMatch = text2?.match(/\{[\s\S]*\}/);
            const response2 = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
            if (!response2.actual_existence && s1.confidence < 0.8)
                return null;
            return {
                pointId: point.id,
                creatureId: creature.id,
                status: response2.actual_existence ? 'pending' : 'rejected',
                localRarity: response2.rarity || s1.rarity || 'Rare',
                confidence: (s1.confidence + (response2.actual_existence ? 0.3 : 0)) / 1.3,
                reasoning: response2.evidence || s1.reasoning,
                method: 'flash-with-grounding'
            };
        }
        catch (error) {
            return null;
        }
    }
}
exports.CleansingEngine = CleansingEngine;
//# sourceMappingURL=cleansingEngine.js.map