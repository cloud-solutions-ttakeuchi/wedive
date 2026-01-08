export interface Region {
  id: string;
  name: string;
  description?: string;
}

export interface Zone {
  id: string;
  name: string;
  regionId: string;
  description?: string;
}

export interface Area {
  id: string;
  name: string;
  zoneId: string;
  regionId: string;
  description?: string;
}

export interface ReviewRadar {
  visibility: number;      // 透明度
  satisfaction: number;    // 満足度
  excite: number;          // エキサイト
  comfort: number;         // 快適さ・余裕度
  encounter: number;       // 生物遭遇率
  topography: number;      // 地形満足度
}

export interface MonthlyStats {
  month: number;
  visibility: number;       // 透明度 (m)
  visibility_score: number; // 透明度スコア (1-5)
  encounter: number;
  excite: number;
  topography: number;
  comfort: number;
  satisfaction: number;
  count: number;
}

export interface Point {
  id: string;
  name: string;
  areaId: string;
  zoneId: string;
  regionId: string;

  // Hierarchy (Search/Filter)
  region: string;
  zone: string;
  area: string;

  // Attributes
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  maxDepth: number;
  mainDepth?: { min: number; max: number };
  entryType: 'beach' | 'boat' | 'entry_easy';
  current: 'none' | 'weak' | 'strong' | 'drift';

  // Topography & Environment
  topography: string[]; // 'sand', 'rock', 'dropoff', 'cave', 'muck'

  // Content
  description: string;
  features: string[];

  // Location
  coordinates?: {
    lat: number;
    lng: number;
  };
  googlePlaceId?: string;
  formattedAddress?: string;

  // System
  status: 'pending' | 'approved' | 'rejected';
  submitterId: string;
  createdAt: string;

  images: string[];
  imageUrl: string;
  imageKeyword?: string;
  bookmarkCount: number;

  // Review & Potential Data
  officialStats?: {
    visibility: [number, number];
    currents: string[];
    difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
    radar: ReviewRadar;
  };
  actualStats?: {
    avgRating: number;
    avgVisibility: number;
    reviewCount?: number;   // Web usage
    totalReviews?: number;  // App usage
    currentCondition?: {
      weather: string;
      wave: string;
    };
    seasonalRadar?: {
      [month: number]: ReviewRadar;
    };
    // App flattened stats
    radar_encounter?: number;
    radar_excite?: number;
    radar_macro?: number;
    radar_comfort?: number;
    radar_topography?: number;
    radar_satisfaction?: number;
    radar_visibility?: number;
    monthly_analysis?: string; // JSON string
  };
  nameKana?: string;
  region_name?: string;
  area_name?: string;
  zone_name?: string;
  latitude?: number;
  longitude?: number;
  rating?: number;
}

export type DivingPoint = Point;
export type Rarity = 'Common' | 'Rare' | 'Epic' | 'Legendary';

// --- Master Data Types ---
export interface CertificationRank {
  id: string;
  name: string;
  level: number; // 0=N/A, 10=Entry, 20=Advanced, 30=Rescue, 40=Master, 50=Instructor (Example)
  abbreviation?: string;
  commonRank?: 'OW' | 'AOW' | 'RED' | 'DM' | 'INST' | 'OTHER';
}

export interface AgencyMaster {
  id: string;
  name: string;
  ranks: CertificationRank[];
  website?: string;
  logoUrl?: string;
}

// Deprecated alias for transition
export type CertificationMaster = AgencyMaster;
export type OrganizationMaster = AgencyMaster;

export interface BadgeMaster {
  id: string;
  name: string;
  iconUrl: string;
  condition: {
    type: string;
    threshold: number;
  };
}

export interface RankMaster {
  id: string;
  name: string;
  minScore: number;
  roleUpgrade: boolean;
  designColor: string;
  icon: string;
}

export type PointCreature = {
  id: string; // pointId_creatureId
  pointId: string;
  creatureId: string;
  localRarity: Rarity;
  lastSighted?: string;
  status: 'approved' | 'pending' | 'deletion_requested' | 'rejected';
  reasoning?: string;
  confidence?: number;
};

export interface User {
  id: string;
  name: string;
  role: 'user' | 'moderator' | 'admin';
  trustScore: number;
  profileImage?: string;
  favorites: {
    points: { id: string; isPrimary: boolean }[];
    areas: { id: string; isPrimary: boolean }[];
    shops: { name: string; isPrimary: boolean }[];
    gear: {
      tanks: {
        name: string;
        specs: { material?: 'steel' | 'aluminum'; capacity?: number; gasType?: string; };
        isPrimary: boolean;
      }[];
    };
  };
  favoriteCreatureIds: string[];
  wanted: string[];
  bookmarkedPointIds: string[];
  createdAt?: string;
  status?: UserStatus;
  certification?: {
    orgId: string;
    rankId: string;
    date: string;
  };
  badges?: {
    badgeId: string;
    earnedAt: string;
  }[];
  agreedTermsVersion?: string;
  isTermsAgreed?: boolean;
  agreedAt?: string;
  aiChatTickets?: {
    totalAvailable: number;
    lastDailyGrant?: string; // YYYY-MM-DD
    periodContribution?: {
      points: number;
      creatures: number;
      reviews: number;
    };
  };
}

export interface ChatTicket {
  id: string;
  type: 'daily' | 'contribution' | 'bonus' | 'purchased';
  count: number;
  remainingCount: number;
  grantedAt: string;
  expiresAt?: string | null;
  status: 'active' | 'used' | 'expired';
  reason?: string;
  metadata?: Record<string, any>;
}

export type UserStatus = 'provisional' | 'active' | 'suspended' | 'withdrawn';

export interface Creature {
  id: string;
  name: string;
  scientificName?: string;
  englishName?: string;
  nameKana?: string; // Added for SQLite search text
  family?: string;
  category: string;
  description: string;
  rarity: Rarity;
  imageUrl: string;
  tags: string[];
  depthRange?: { min: number; max: number };
  specialAttributes?: string[];
  waterTempRange?: { min: number; max: number };
  status: 'pending' | 'approved' | 'rejected';
  size?: string;
  season?: string[];
  locationIds?: string[];
  submitterId?: string;
  gallery?: string[];
  stats?: CreatureStats;
  imageCredit?: string;
  imageLicense?: string;
  imageKeyword?: string;
  createdAt?: string;
}

export type CreatureStats = {
  popularity: number;
  size: number;
  danger: number;
  lifespan: number;
  rarity: number;
  speed: number;
};

export interface DiveLog {
  id: string;
  userId: string;
  date: string;
  diveNumber: number;
  location: {
    pointId: string;
    pointName: string;
    region: string;
    shopName?: string;
    lat?: number;
    lng?: number;
  };
  team?: {
    buddy?: string;
    guide?: string;
    members?: string[];
  };
  time: {
    entry?: string;
    exit?: string;
    duration: number;
    surfaceInterval?: number;
  };
  depth: {
    max: number;
    average: number;
  };
  condition?: {
    weather?: 'sunny' | 'cloudy' | 'rainy' | 'stormy';
    airTemp?: number;
    waterTemp?: {
      surface?: number;
      bottom?: number;
    };
    transparency?: number;
    wave?: 'none' | 'low' | 'high';
    current?: 'none' | 'weak' | 'strong';
    surge?: 'none' | 'weak' | 'strong';
    waterType?: 'salt' | 'fresh';
  };
  gear?: {
    suitType?: 'wet' | 'dry';
    suitThickness?: number;
    weight?: number;
    tank?: {
      material?: 'steel' | 'aluminum';
      capacity?: number;
      pressureStart?: number;
      pressureEnd?: number;
      gasType?: string;
      oxygen?: number;
    };
  };
  entryType?: 'beach' | 'boat';
  creatureId?: string;
  sightedCreatures?: string[];
  photos: string[];
  comment: string;
  isPrivate: boolean;
  likeCount: number;
  likedBy: string[];
  spotId: string;
  title?: string;
  garminActivityId?: string;
  profile?: {
    depth?: number;
    temp?: number;
    hr?: number;
    time: number;
  }[];
  reviewId?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type Log = DiveLog;

export interface EditProposal {
  targetId?: string;
  proposalType: 'create' | 'update' | 'delete';
  diffData?: any;
  submitterId: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: string;
  processedAt?: string;
  [key: string]: any;
}

export type CreatureProposal = Creature & EditProposal;
export type PointProposal = Point & EditProposal;

export interface PointCreatureProposal {
  id: string;
  targetId: string;
  pointId: string;
  creatureId: string;
  localRarity: Rarity;
  proposalType: 'create' | 'delete';
  submitterId: string;
  status: 'pending' | 'approved' | 'rejected';
  reasoning?: string;
  confidence?: number;
  createdAt: string;
  processedAt?: string;
}

export interface Review {
  id: string;
  pointId: string;
  areaId?: string;
  zoneId?: string;
  regionId?: string;
  userId: string;
  logId?: string;
  userName: string;
  userProfileImage?: string;
  userLogsCount: number;
  userOrgId?: string;
  userRank?: string;
  rating: number;
  comment: string;
  images: string[];
  condition: {
    weather: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'typhoon' | 'spring_bloom';
    airTemp?: number;
    waterTemp?: number;
    wave: 'none' | 'low' | 'high';
    wind?: string;
  };
  metrics: {
    visibility: number;
    flow: 'none' | 'weak' | 'strong' | 'drift';
    difficulty: 'easy' | 'normal' | 'hard';
    macroWideRatio: number;
    terrainIntensity?: number;
    depthAvg?: number;
    depthMax?: number;
  };
  radar: ReviewRadar;
  tags: string[];
  status: 'pending' | 'approved' | 'rejected';
  trustLevel: 'standard' | 'verified' | 'expert' | 'professional' | 'official';
  helpfulCount: number;
  helpfulBy: string[];
  date: string;
  createdAt: string;
}
