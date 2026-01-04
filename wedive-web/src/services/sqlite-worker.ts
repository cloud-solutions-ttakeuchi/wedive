// @ts-ignore
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
// @ts-ignore
import wasmUrl from '../assets/sqlite3.wasm?url';

/**
 * SQLite WASM をバックグラウンドで初期化するためのワーカー
 * Vite の ?url import を使用して、WASM ファイルのパスを確実に解決します
 */
sqlite3InitModule({
  locateFile: (path: string) => {
    if (path.endsWith('.wasm')) {
      // console.log('[SQLite Web] Loading WASM from Vite resolved URL:', wasmUrl);
      return wasmUrl;
    }
    return path;
  }
}).then((sqlite3: any) => {
  try {
    // 公式の Worker1 API を有効にする
    // @ts-ignore
    sqlite3.initWorker1API();
    console.log('[SQLite Worker] Background thread initialization complete.');
  } catch (e) {
    console.error('[SQLite Worker] Failed to initialize Worker API:', e);
  }
});
