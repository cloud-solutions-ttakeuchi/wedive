"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runDataCleansing = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const cleansingEngine_1 = require("../ai/cleansingEngine");
const firestore_1 = require("firebase-admin/firestore");
const db = (0, firestore_1.getFirestore)();
/**
 * Trigger Point-Creature Cleansing Job via Web API
 */
exports.runDataCleansing = (0, https_1.onCall)({ region: "asia-northeast1", memory: "1GiB", timeoutSeconds: 300 }, async (request) => {
    const { auth, data } = request;
    // 1. Auth Check (Admin Only)
    if (!auth)
        throw new https_1.HttpsError("unauthenticated", "Auth required");
    const userDoc = await db.collection("users").doc(auth.uid).get();
    const userData = userDoc.data();
    if (!userData || userData.role !== 'admin') {
        throw new https_1.HttpsError("permission-denied", "Admin role required");
    }
    const { mode, pointId, creatureId } = data;
    const engine = new cleansingEngine_1.CleansingEngine(process.env.GCLOUD_PROJECT || "wedive-app");
    logger.info(`Starting Cleansing Job: Mode=${mode}, PointID=${pointId}, CreatureID=${creatureId}`);
    // 2. Fetch Target Data based on Mode
    // For simplicity in this serverless implementation, we handle small batches.
    // Full re-cleansing should ideally be handled by the Python script or a background task.
    try {
        let points = [];
        let creatures = [];
        if (mode === 'specific' && pointId) {
            const p = await db.collection('points').doc(pointId).get();
            if (p.exists)
                points.push({ ...p.data(), id: p.id });
            if (creatureId) {
                const c = await db.collection('creatures').doc(creatureId).get();
                if (c.exists)
                    creatures.push({ ...c.data(), id: c.id });
            }
            else {
                // Default to a small subset for demonstration/testing in specific mode if no creature specified
                const cSnap = await db.collection('creatures').limit(20).get();
                creatures = cSnap.docs.map(d => ({ ...d.data(), id: d.id }));
            }
        }
        else if (mode === 'new') {
            // Find points with no associations? (simplified logic)
            const pSnap = await db.collection('points').limit(5).get();
            points = pSnap.docs.map(d => ({ ...d.data(), id: d.id }));
            const cSnap = await db.collection('creatures').limit(10).get();
            creatures = cSnap.docs.map(d => ({ ...d.data(), id: d.id }));
        }
        // 3. Clear existing if mode is 'replace' or 'all'
        if (mode === 'replace' || mode === 'all') {
            logger.info(`Clearing existing associations for ${points.length} points...`);
            for (const p of points) {
                const existingSnap = await db.collection('point_creatures').where('pointId', '==', p.id).get();
                const batch = db.batch();
                existingSnap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        }
        // 4. Run Pipeline in Batches
        const results = [];
        const BATCH_SIZE = 15;
        for (const p of points) {
            // Process creatures in batches for this point
            for (let i = 0; i < creatures.length; i += BATCH_SIZE) {
                const creatureBatch = creatures.slice(i, i + BATCH_SIZE);
                const batchResults = await engine.verifyBatch(p, creatureBatch);
                for (const mapping of batchResults) {
                    if (mapping.status === 'pending') {
                        const docId = `${p.id}_${mapping.creatureId}`;
                        await db.collection('point_creatures').doc(docId).set({
                            ...mapping,
                            updatedAt: new Date().toISOString()
                        });
                        results.push(mapping);
                    }
                }
            }
        }
        return {
            success: true,
            processedCount: points.length * creatures.length,
            newMappingsCount: results.length,
            results
        };
    }
    catch (error) {
        logger.error("Cleansing job failed:", error);
        throw new https_1.HttpsError("internal", error.message);
    }
});
//# sourceMappingURL=cleansing.js.map