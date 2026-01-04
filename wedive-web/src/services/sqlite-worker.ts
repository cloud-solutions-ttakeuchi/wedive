// sqlite-worker.ts - SQLite WASM 用のバックグラウンドワーカー
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

/**
 * SQLite WASM をバックグラウンドで初期化します。
 * 画面側（メインスレッド）からは Promiser API を介してこのワーカーへ命令を送ります。
 */
sqlite3InitModule().then((sqlite3) => {
  try {
    // 公式の Worker1 API を有効にする
    // @ts-ignore
    sqlite3.initWorker1API();
    console.log('[SQLite Worker] Background thread initialization complete.');
  } catch (e) {
    console.error('[SQLite Worker] Failed to initialize Worker API:', e);
  }
});
