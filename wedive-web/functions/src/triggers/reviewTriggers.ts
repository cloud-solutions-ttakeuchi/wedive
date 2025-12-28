import { onDocumentWritten } from "firebase-functions/v2/firestore";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";

const db = admin.firestore();

export const onReviewWriteAggregateStats = onDocumentWritten({
  document: "reviews/{reviewId}",
  region: "asia-northeast1",
}, async (event) => {
  const data = event.data?.after.data() || event.data?.before.data();
  if (!data) return;

  const pointId = data.pointId;
  if (!pointId) return;

  logger.info(`Aggregating stats for point: ${pointId}`);

  try {
    const reviewsSnap = await db.collection("reviews")
      .where("pointId", "==", pointId)
      .orderBy("createdAt", "desc")
      .get();

    const reviews = reviewsSnap.docs.map(doc => doc.data());
    const count = reviews.length;

    if (count === 0) {
      await db.doc(`points/${pointId}`).update({
        actualStats: admin.firestore.FieldValue.delete()
      });
      return;
    }

    const totalRating = reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
    const totalVis = reviews.reduce((sum, r) => sum + (r.metrics?.visibility || 0), 0);

    // Calculate avg radar
    const avgRadar = {
      encounter: reviews.reduce((sum, r) => sum + (r.radar?.encounter || 0), 0) / count,
      excite: reviews.reduce((sum, r) => sum + (r.radar?.excite || 0), 0) / count,
      macro: reviews.reduce((sum, r) => sum + (r.radar?.macro || 0), 0) / count,
      comfort: reviews.reduce((sum, r) => sum + (r.radar?.comfort || 0), 0) / count,
      visibility: reviews.reduce((sum, r) => sum + (r.radar?.visibility || 0), 0) / count,
    };

    const latestReview = reviews[0];
    const difficultyCount = reviews.slice(0, 5).filter(r => r.metrics?.difficulty === 'hard').length;
    const recentHardDifficulty = difficultyCount >= 2; // e.g., 2 out of 5 are hard

    const actualStats = {
      avgRating: totalRating / count,
      avgVisibility: totalVis / count,
      avgRadar,
      reviewCount: count,
      recentHardDifficulty,
      currentCondition: latestReview.condition || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.doc(`points/${pointId}`).update({
      actualStats
    });

    logger.info(`Successfully updated stats for point: ${pointId}`);

  } catch (error) {
    logger.error("Error aggregating review stats:", error);
  }
});
