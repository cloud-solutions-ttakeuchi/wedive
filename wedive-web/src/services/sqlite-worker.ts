/**
 * SQLite WASM をバックグラウンドで初期化するためのワーカー
 * Vite のビルドプロセスを回避し、public フォルダに配置された生のファイルをロードします。
 * これにより、ファイル名のハッシュ化を防ぎ、相対パスによる依存関係解決(Proxy Worker等)を正常化します。
 */
const initSQLite = async () => {
  try {
    // @ts-ignore
    const { default: sqlite3InitModule } = await import(/* @vite-ignore */ '/sqlite3/sqlite3.mjs');

    sqlite3InitModule({
      print: console.log,
      printErr: console.error,
      // OPFS Proxy Worker のパスを明示的に指定して自動解決の失敗を防ぐ
      proxyUri: '/sqlite3/sqlite3-opfs-async-proxy.js',
    }).then((sqlite3: any) => {
      try {
        // @ts-ignore
        if (sqlite3.initWorker1API) {
          // @ts-ignore
          sqlite3.initWorker1API();
          console.log('[SQLite Worker] Background thread initialization complete.');
        } else {
          console.error('[SQLite Worker] sqlite3.initWorker1API is missing.');
        }
      } catch (e) {
        console.error('[SQLite Worker] Failed to initialize Worker API inside module:', e);
      }
    });
  } catch (err) {
    console.error('[SQLite Worker] Failed to load sqlite3.mjs from public directory:', err);
  }
};

initSQLite();
