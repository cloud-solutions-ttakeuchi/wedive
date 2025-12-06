export type Language = 'en' | 'ja';

export const translations = {
  en: {
    // Common
    'common.search': 'Search',
    'common.back': 'Back',
    'common.loading': 'Loading...',
    'common.guest': 'Guest Mode',
    'common.login_required': 'Log in to track your discoveries, earn badges, and analyze your diving stats.',

    // Navigation
    'nav.home': 'Home',
    'nav.pokedex': 'Pokedex',
    'nav.mypage': 'My Page',
    'nav.login': 'Log In',
    'nav.logout': 'Log Out',

    // Home
    'home.title': 'Field Guide',
    'home.search_creatures': 'Search Creatures',
    'home.points_in': 'Points in',
    'home.popular_spots': 'Popular Spots',
    'home.trending_creatures': 'Trending Creatures',
    'home.sightings': 'sightings',
    'home.logs': 'logs',

    // Pokedex
    'pokedex.title': 'Global Pokedex',
    'pokedex.search_placeholder': 'Search creatures...',
    'pokedex.no_results': 'No creatures found.',

    // Spot Detail
    'spot.difficulty': 'Difficulty',
    'spot.features': 'Features',
    'spot.field_guide': 'Field Guide (Inhabitants)',
    'spot.field_guide_desc': 'Creatures found here. Tap to view details or log your discovery.',
    'spot.not_found': 'Point not found',
    'spot.species': 'species',
    'spot.log': 'Log',

    // Creature Detail
    'creature.global_rarity': 'Global Rarity',
    'creature.status': 'Status',
    'creature.discovered': 'Discovered',
    'creature.not_found': 'Not Found',
    'creature.not_found_message': 'Creature not found',
    'creature.where_to_find': 'Where to find (Reverse Lookup)',
    'creature.found_button': 'I Found This Here!',
    'creature.log_title': 'Log Discovery',
    'creature.where': 'Where?',
    'creature.select_point': 'Select a point...',
    'creature.comment': 'Comment (Optional)',
    'creature.comment_placeholder': 'It was huge!',
    'creature.cancel': 'Cancel',
    'creature.save': 'Save Log',

    // My Page
    'mypage.pro_diver': 'Pro Diver',
    'mypage.dives': 'Dives',
    'mypage.found': 'Found',
    'mypage.comp': 'Comp.',
    'mypage.dashboard': 'Dashboard',
    'mypage.logbook': 'Logbook',
    'mypage.collection': 'Collection',
    'mypage.activity_zone': 'Activity by Zone',
    'mypage.point_mastery': 'Point Mastery',
    'mypage.mastery': 'Mastery',
    'mypage.recent_logs': 'Recent Logs',
    'mypage.no_logs': 'No logs yet. Go dive!',
  },
  ja: {
    // Common
    'common.search': '検索',
    'common.back': '戻る',
    'common.loading': '読み込み中...',
    'common.guest': 'ゲストモード',
    'common.login_required': 'ログインして発見ログを記録し、バッジを獲得したり統計を確認しましょう。',

    // Navigation
    'nav.home': 'ホーム',
    'nav.pokedex': '図鑑',
    'nav.mypage': 'マイページ',
    'nav.login': 'ログイン',
    'nav.logout': 'ログアウト',

    // Home
    'home.title': 'フィールドガイド',
    'home.search_creatures': '生物を探す',
    'home.points_in': 'エリア内のポイント',
    'home.popular_spots': '人気のスポット',
    'home.trending_creatures': '今、会える生物',
    'home.sightings': '発見数',
    'home.logs': 'ログ',

    // Pokedex
    'pokedex.title': '全生物図鑑',
    'pokedex.search_placeholder': '生物を検索...',
    'pokedex.no_results': '見つかりませんでした。',

    // Spot Detail
    'spot.difficulty': '難易度',
    'spot.features': '特徴',
    'spot.field_guide': '生息する生物リスト',
    'spot.field_guide_desc': 'ここで見られる生物です。タップして詳細を見るか、発見ログを登録できます。',
    'spot.not_found': 'ポイントが見つかりません',
    'spot.species': '種',
    'spot.log': '記録',

    // Creature Detail
    'creature.global_rarity': '基本レア度',
    'creature.status': '発見状況',
    'creature.discovered': '発見済み！',
    'creature.not_found': '未発見',
    'creature.not_found_message': '生物が見つかりません',
    'creature.where_to_find': 'どこで会える？ (逆引き)',
    'creature.found_button': 'ここで見つけた！',
    'creature.log_title': '発見ログを登録',
    'creature.where': '場所は？',
    'creature.select_point': 'ポイントを選択...',
    'creature.comment': 'コメント (任意)',
    'creature.comment_placeholder': 'でかかった！',
    'creature.cancel': 'キャンセル',
    'creature.save': 'ログを保存',

    // My Page
    'mypage.pro_diver': 'プロダイバー',
    'mypage.dives': 'ダイブ数',
    'mypage.found': '発見数',
    'mypage.comp': '達成率',
    'mypage.dashboard': 'ダッシュボード',
    'mypage.logbook': 'ログブック',
    'mypage.collection': 'コレクション',
    'mypage.activity_zone': 'エリア別活動量',
    'mypage.point_mastery': 'ポイント攻略度',
    'mypage.mastery': '攻略率',
    'mypage.recent_logs': '最近のログ',
    'mypage.no_logs': 'ログはまだありません。潜りに行こう！',
  }
};
