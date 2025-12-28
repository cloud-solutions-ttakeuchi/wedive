import type { RankMaster, CertificationMaster, BadgeMaster } from '../types';

export const TRUST_RANKS: RankMaster[] = [
  { id: 'apprentice', name: '見習いダイバー', minScore: 0, roleUpgrade: false, designColor: 'gray-400', icon: 'Droplet' },
  { id: 'explorer', name: '知識の先駆者', minScore: 20, roleUpgrade: false, designColor: 'blue-500', icon: 'Map' },
  { id: 'pioneer', name: '専門家候補', minScore: 50, roleUpgrade: true, designColor: 'purple-500', icon: 'Aperture' },
  { id: 'sage', name: '図鑑の賢者', minScore: 100, roleUpgrade: true, designColor: 'amber-500', icon: 'Crown' }
];

export const CERTIFICATIONS: CertificationMaster[] = [
  {
    id: 'padi',
    name: 'PADI',
    ranks: [
      { id: 'entry', name: 'OWD', level: 1 },
      { id: 'advanced', name: 'AOW', level: 2 },
      { id: 'expert', name: 'Rescue / MSD', level: 3 },
      { id: 'guide', name: 'DM', level: 4 },
      { id: 'instructor', name: 'OWSI', level: 5 },
    ]
  },
  {
    id: 'naui',
    name: 'NAUI',
    ranks: [
      { id: 'entry', name: 'オープンウォーター', level: 1 },
      { id: 'advanced', name: 'アドバンススクーバ', level: 2 },
      { id: 'expert', name: 'マスターダイバー', level: 3 },
      { id: 'guide', name: 'ダイブマスター', level: 4 },
      { id: 'instructor', name: 'インストラクター', level: 5 },
    ]
  },
  {
    id: 'ssi',
    name: 'SSI',
    ranks: [
      { id: 'entry', name: 'OWD', level: 1 },
      { id: 'advanced', name: 'アドバンスド・アドベンチュアラー', level: 2 },
      { id: 'expert', name: 'マスターダイバー', level: 3 },
      { id: 'guide', name: 'ダイブマスター', level: 4 },
      { id: 'instructor', name: 'OWI', level: 5 },
    ]
  },
  {
    id: 'cmas',
    name: 'CMAS',
    ranks: [
      { id: 'entry', name: '1スター', level: 1 },
      { id: 'advanced', name: '2スター', level: 2 },
      { id: 'expert', name: '3スター', level: 3 },
      { id: 'guide', name: '4スター', level: 4 },
      { id: 'instructor', name: 'モノトール(M)', level: 5 },
    ]
  },
  {
    id: 'bsac',
    name: 'BSAC',
    ranks: [
      { id: 'entry', name: 'オーシャンダイバー', level: 1 },
      { id: 'advanced', name: 'スポーツダイバー', level: 2 },
      { id: 'expert', name: 'ダイブリーダー', level: 3 },
      { id: 'guide', name: 'アドバンスダイバー', level: 4 },
      { id: 'instructor', name: 'インストラクター', level: 5 },
    ]
  }
];

export const BADGE_MASTER: BadgeMaster[] = [
  {
    id: 'bg_izu_master',
    name: '伊豆マスター',
    iconUrl: '/images/badges/izu_master.png',
    condition: { type: 'dive_count_in_zone', threshold: 50 }
  },
  {
    id: 'bg_okinawa_lover',
    name: '沖縄ラバー',
    iconUrl: '/images/badges/okinawa.png',
    condition: { type: 'dive_count_in_zone', threshold: 30 }
  },
  {
    id: 'bg_shark_hunter',
    name: 'シャークハンター',
    iconUrl: '/images/badges/shark.png',
    condition: { type: 'sighting_count', threshold: 10 }
  }
];
