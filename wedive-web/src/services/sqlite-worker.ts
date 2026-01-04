import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// @ts-ignore - Bypass package exports restriction AND get the correct hashed URL from Vite
import wasmUrl from '../../../node_modules/@sqlite.org/sqlite-wasm/sqlite-wasm/jswasm/sqlite3.wasm?url';

/**
 * SQLite WASM をバックグラウンドで初期化するためのワーカー
 * locateFile に Vite が解決した正確な URL (wasmUrl) を渡します
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
