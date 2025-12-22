export const FEATURE_FLAGS = {
  // DB Schema v2.2.9: ID Normalization and Hierarchical Search
  // Since this is a core schema change, it is always true in this version.
  ENABLE_ID_BASED_HIERARCHY: true,

  // Advanced dropdowns for region/zone/area in edit page
  ADVANCED_LOCATION_PICKER: true,

  // AI-powered features (from previous versions)
  AI_AUTO_FILL: true,
  AI_CONCIERGE: true,
};
