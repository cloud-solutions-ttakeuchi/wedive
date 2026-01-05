// CDNからロードすることでローカルパス問題を回避
const CDN_BASE = 'https://unpkg.com/@sqlite.org/sqlite-wasm@3.46.0/sqlite-wasm/jswasm';

const initSQLite = async () => {
  try {
    // @ts-ignore
    const { default: sqlite3InitModule } = await import(/* @vite-ignore */ `${CDN_BASE}/sqlite3.mjs`);

    sqlite3InitModule({
      print: console.log,
      printErr: console.error,
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) return `${CDN_BASE}/sqlite3.wasm`;
        return file;
      }
    }).then((sqlite3: any) => {
      try {
        console.log('[SQLite Worker] Initialized using CDN assets.');
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
    console.error('[SQLite Worker] Failed to load sqlite3.mjs from CDN:', err);
  }
};

initSQLite();
