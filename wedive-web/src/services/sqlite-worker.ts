// @ts-ignore
import sqlite3InitModule from './sqlite3.mjs';

/**
 * SQLite WASM をバックグラウンドで初期化するためのワーカー
 * locateFile を使用して、public フォルダに配置した WASM ファイルを直接指定します
 */
sqlite3InitModule({
  locateFile: (path) => {
    if (path.endsWith('.wasm')) {
      console.log('[SQLite Web] Loading WASM from hardcoded path: /sqlite3.wasm');
      return '/sqlite3.wasm';
    }
    return path;
  }
}).then((sqlite3) => {
  try {
    // 公式の Worker1 API を有効にする
    // @ts-ignore
    sqlite3.initWorker1API();
    console.log('[SQLite Worker] Background thread initialization complete.');
  } catch (e) {
    console.error('[SQLite Worker] Failed to initialize Worker API:', e);
  }
});
