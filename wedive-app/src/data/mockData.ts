import { Creature, Point } from '../types';

export const MOCK_CREATURES: Creature[] = [
  {
    id: 'c1',
    name: 'アオウミガメ',
    category: 'カメ',
    rarity: 'Rare',
    imageUrl: 'https://images.unsplash.com/photo-1544551763-47a184117db7?auto=format&fit=crop&q=80&w=400',
    description: 'ゆったりと泳ぐ姿が人気のウミガメです。',
    status: 'approved',
    tags: ['カメ', '人気'],
    scientificName: 'Chelonia mydas',
  },
  {
    id: 'c2',
    name: 'クマノミ',
    category: '魚類',
    rarity: 'Common',
    imageUrl: 'https://images.unsplash.com/photo-1544551763-7c97a3cb5156?auto=format&fit=crop&q=80&w=400',
    description: 'イソギンチャクと共生するおなじみの魚です。',
    status: 'approved',
    tags: ['クマノミ', '共生魚'],
    scientificName: 'Amphiprioninae',
  }
];

export const MOCK_POINTS: Point[] = [
  {
    id: 'p1',
    name: 'フト根',
    region: '西伊豆',
    zone: '田子',
    area: '田子',
    regionId: 'r1',
    zoneId: 'z1',
    areaId: 'a1',
    level: 'Advanced',
    maxDepth: 35,
    entryType: 'boat',
    current: 'strong',
    topography: ['rock', 'dropoff'],
    description: '巨大な根がそびえ立つ、西伊豆屈指 of the best ダイナミックなポイント。',
    imageUrl: 'https://images.unsplash.com/photo-1583212292454-1fe6229603b7?auto=format&fit=crop&q=80&w=400',
    features: ['回遊魚', 'キンギョハナダイ'],
    status: 'approved',
    bookmarkCount: 15,
    submitterId: 'admin',
    createdAt: '2024-01-01T00:00:00Z',
    images: ['https://images.unsplash.com/photo-1583212292454-1fe6229603b7?auto=format&fit=crop&q=80&w=400'],
  }
];

export const MOCK_LOGS = [
  {
    id: 'l1',
    userId: 'u1',
    userName: 'Kaito',
    userAvatar: 'https://images.unsplash.com/photo-1599566150163-29194dcaad36?auto=format&fit=crop&q=80&w=100',
    pointId: 'p1',
    pointName: 'フト根',
    creatureId: 'c1',
    creatureName: 'アオウミガメ',
    date: '2024-12-20',
    depth: 25.5,
    temp: 18,
    comment: '透明度抜群！ウミガメにも会えました。',
    imageUrl: 'https://images.unsplash.com/photo-1544551763-47a184117db7?auto=format&fit=crop&q=80&w=400',
  },
  {
    id: 'l2',
    userId: 'u2',
    userName: 'Ami',
    userAvatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=100',
    pointId: 'p1',
    pointName: 'フト根',
    creatureId: 'c2',
    creatureName: 'クマノミ',
    date: '2024-12-19',
    depth: 15.2,
    temp: 19,
    comment: 'クマノミのペアが可愛かったです。',
    imageUrl: 'https://images.unsplash.com/photo-1544551763-7c97a3cb5156?auto=format&fit=crop&q=80&w=400',
  }
];
