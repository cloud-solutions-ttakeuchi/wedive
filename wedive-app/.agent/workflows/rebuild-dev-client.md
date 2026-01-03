---
description: ネイティブモジュール（expo-sqlite等）を追加した後の開発クライアント再ビルド手順
---

## 概要
`expo-sqlite` や `expo-asset` などのネイティブモジュールを新しく導入した場合、通常の `npx expo start` だけではモジュールが見つからずエラーになります。以下の手順で開発者用のネイティブアプリ（Dev Client）を再ビルドしてください。

## 前提条件
- macOS (iOSビルドの場合)
- Xcode がインストールされ、最新の状態であること
- Android Studio / SDK がセットアップ済みであること

## 手順

### 1. 同梱データの最新化
ビルド時に最新のマスターデータをアプリ内に含めるため、以下のコマンドを実行します。
```bash
cd wedive-app
npm run update-master
```

### 2. ネイティブビルドの実行

#### iOS (シミュレーター)
```bash
npx expo run:ios
```

#### iOS (実機)
※MacにiPhoneを接続した状態で実行
```bash
npx expo run:ios --device
```

#### Android (エミュレーター/実機)
```bash
npx expo run:android
```

### 3. ビルド後の起動
ビルドが成功すると、自動的にアプリが立ち上がります。
その後は、いつもの起動コマンドで開発を継続できます。
```bash
npx expo start --dev-client
```

## トラブルシューティング
- **CocoaPodsのエラー**: `cd ios && pod install && cd ..` を試してください。
- **キャッシュのクリア**: `npx expo start -c` で起動してください。
