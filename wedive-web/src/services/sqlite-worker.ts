// sqlite-worker.ts - SQLite WASM 用のバックグラウンドワーカー
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// @ts-ignore - Vite special import to get the hashed URL of the WASM file
import wasmUrl from '@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm?url';

/**
 * SQLite WASM をバックグラウンドで初期化するためのワーカー
 * locateFile を使用して Vite がビルドした WASM ファイルの正確な場所を伝えます
 */
sqlite3InitModule({
  locateFile: (path) => {
    if (path.endsWith('.wasm')) return wasmUrl;
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
