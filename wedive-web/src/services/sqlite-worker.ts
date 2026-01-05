// @ts-ignore
import sqlite3InitModule from '../assets/jswasm/sqlite3.mjs';
// @ts-ignore
import wasmUrl from '../assets/jswasm/sqlite3.wasm?url';

const initSQLite = async () => {
  try {
    console.log('[SQLite Worker] Initializing SQLite3...');
    sqlite3InitModule({
      print: console.log,
      printErr: console.error,
      locateFile: (file: string) => {
        if (file.endsWith('.wasm')) {
          return wasmUrl;
        }
        return file;
      }
    }).then((sqlite3: any) => {
      try {
        console.log('[SQLite Worker] Module loaded.');
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
    console.error('[SQLite Worker] Failed to load sqlite3 module:', err);
  }
};

initSQLite();
