import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { CleansingEngine } from "../ai/cleansingEngine";
import { getFirestore } from "firebase-admin/firestore";

const db = getFirestore();

/**
 * Trigger Point-Creature Cleansing Job via Web API
 */
export const runDataCleansing = onCall({ region: "asia-northeast1", memory: "1GiB", timeoutSeconds: 300 }, async (request) => {
  const { auth, data } = request;

  // 1. Auth Check (Admin Only)
  if (!auth) throw new HttpsError("unauthenticated", "Auth required");

  const userDoc = await db.collection("users").doc(auth.uid).get();
  const userData = userDoc.data();
  if (!userData || userData.role !== 'admin') {
    throw new HttpsError("permission-denied", "Admin role required");
  }

  const { mode, pointId, creatureId, regionId, zoneId, areaId } = data;
  const engine = new CleansingEngine(process.env.GCLOUD_PROJECT || "wedive-app");

  logger.info(`Starting Cleansing Job: Mode=${mode}, PointID=${pointId}, RegionID=${regionId}, ZoneID=${zoneId}, AreaID=${areaId}, CreatureID=${creatureId}`);

  try {
    let points: any[] = [];
    let creatures: any[] = [];

    // 2. Fetch Points based on Hierarchy
    if (pointId) {
      const p = await db.collection('points').doc(pointId).get();
      if (p.exists) points.push({ ...p.data(), id: p.id });
    } else if (areaId) {
      const pSnap = await db.collection('points').where('areaId', '==', areaId).get();
      points = pSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    } else if (zoneId) {
      const aSnap = await db.collection('areas').where('zoneId', '==', zoneId).get();
      const aIds = aSnap.docs.map(d => d.id);
      if (aIds.length > 0) {
        const pSnap = await db.collection('points').where('areaId', 'in', aIds).get();
        points = pSnap.docs.map(d => ({ ...d.data(), id: d.id }));
      }
    } else if (regionId) {
      const zSnap = await db.collection('zones').where('regionId', '==', regionId).get();
      const zIds = zSnap.docs.map(d => d.id);
      if (zIds.length > 0) {
        const aSnap = await db.collection('areas').where('zoneId', 'in', zIds).get();
        const aIds = aSnap.docs.map(d => d.id);
        if (aIds.length > 0) {
          // Chunk areaIds if more than 10 (Firestore 'in' limit)
          for (let i = 0; i < aIds.length; i += 10) {
            const chunk = aIds.slice(i, i + 10);
            const pSnap = await db.collection('points').where('areaId', 'in', chunk).get();
            points.push(...pSnap.docs.map(d => ({ ...d.data(), id: d.id })));
          }
        }
      }
    } else if (mode === 'new' || mode === 'all') {
      const pSnap = await db.collection('points').limit(20).get();
      points = pSnap.docs.map(d => ({ ...d.data(), id: d.id }));
    }

    // 2b. Fetch Creatures
    if (creatureId) {
      const c = await db.collection('creatures').doc(creatureId).get();
      if (c.exists) creatures.push({ ...c.data(), id: c.id });
    } else {
      // Default to common subset or as needed
      const cSnap = await db.collection('creatures').limit(mode === 'all' ? 100 : 20).get();
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

  } catch (error: any) {
    logger.error("Cleansing job failed:", error);
    throw new HttpsError("internal", error.message);
  }
});
