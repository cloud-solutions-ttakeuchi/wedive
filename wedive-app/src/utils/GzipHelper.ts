import * as FileSystem from 'expo-file-system/legacy';
import pako from 'pako';
import { Buffer } from 'buffer';

const { EncodingType } = FileSystem;

export class GzipHelper {
  /**
   * gzip ファイルを解凍して指定のパスに保存する
   * @param sourceUri gzip形式のファイルURI
   * @param targetPath 保存先のローカルパス
   */
  static async decompressGzipFile(sourceUri: string, targetPath: string): Promise<void> {
    try {
      // 1. ファイルを Base64 で読み込む
      const base64Data = await FileSystem.readAsStringAsync(sourceUri, {
        encoding: EncodingType.Base64,
      });

      // 2. Buffer に変換して pako で解凍
      const binaryData = Buffer.from(base64Data, 'base64');
      const decompressedData = pako.ungzip(binaryData);

      // 3. 解凍後のデータを Base64 で書き込む（expo-file-system は binary 直書きに制限があるため Base64 経由）
      const decompressedBase64 = Buffer.from(decompressedData).toString('base64');

      // ターゲットディレクトリの存在確認
      const dirPath = targetPath.substring(0, targetPath.lastIndexOf('/'));
      const dirInfo = await FileSystem.getInfoAsync(dirPath);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
      }

      await FileSystem.writeAsStringAsync(targetPath, decompressedBase64, {
        encoding: EncodingType.Base64,
      });

      console.log(`Gzip decompressed successfully: ${targetPath}`);
    } catch (error) {
      console.error('Gzip decompression failed:', error);
      throw error;
    }
  }
}
