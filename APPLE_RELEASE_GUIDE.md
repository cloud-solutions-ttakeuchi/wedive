# Apple iOSアプリ リリース手順書 (TestFlight & App Store)

WeDiveアプリのiOS版をビルドし、TestFlightでのテスト配信およびApp Storeへの本番リリースを行うための手順書です。

## 1. 事前準備 (バージョン更新)

リリース前には必ずバージョン番号を更新します。

1. **`wedive-app/app.json` を開く**
2. 以下の項目を更新する:
   - `expo.version`: ユーザーに見えるバージョン（例: "1.1.0"）
   - `expo.ios.buildNumber`: 内部管理用ビルド番号（例: "2", "3"... 必ず前回より大きな整数にする）
   - `expo.android.versionCode`: Android用（iOSと合わせて加算する）

```json
{
  "expo": {
    "version": "1.1.0",
    "ios": {
      "buildNumber": "3"
    },
    ...
  }
}
```

## 2. ビルド前の健全性チェック

依存パッケージの整合性を確認します。

```bash
cd wedive-app
npx expo install --check
```
※ エラーや警告が出た場合、自動修正されるか、指示に従って修正してください。

## 3. TestFlight への配信手順

TestFlight（テスト版）として配信するには、**Productionプロファイル** でビルドし、App Store Connectへアップロードします。

### 手順 A: ビルドとアップロードを一度に行う（推奨）

以下のコマンドを実行すると、ビルド完了後に自動的にAppleへ送信されます。

```bash
# wedive-app ディレクトリで実行
npx eas-cli build --platform ios --profile production --auto-submit
```
- 途中で `Update eas.json to use the default "remote" version source` と聞かれたら **Yes** を推奨（自動でビルド番号を管理してくれます）。
- Apple ID のログインを求められたら入力してください。

### 手順 B: ビルドとアップロードを分ける場合

ビルドだけ先に行う場合:
```bash
npx eas-cli build --platform ios --profile production
```

完了後、最新のビルドをアップロードする場合:
```bash
npx eas-cli submit -p ios --latest
```

### TestFlight での確認
アップロード完了後、App Store Connect で「処理中」となります。数分〜数十分で処理が完了し、TestFlightアプリからインストール可能になります。外部テスターに公開する場合は、Appleの簡易審査（数時間程度）が必要です。

## 4. 本番リリース (App Store)

TestFlightで動作確認が完了したビルドを、そのまま本番として公開します。

1. **App Store Connect にログイン** (https://appstoreconnect.apple.com/)
2. **「マイApp」** > **「WeDive」** を選択。
3. 新しいバージョンの提出準備を行う（左側の「+」から新規バージョン作成）。
4. **「ビルド」セクション** で、先ほどアップロードした（TestFlightでテストした）ビルドを選択。
5. 「審査へ提出」をクリック。
6. Appleの審査（通常24〜48時間）を待つ。
7. 審査通過後、「リリース」ボタンを押して公開（または自動リリース設定）。

## 補足: トラブルシューティング

- **`command not found: eas`**:
  - `npx eas-cli ...` のように `npx` を付けて実行してください。
- **証明書エラー / Provisioning Profile エラー**:
  - `eas build` 実行時に `Generate a new Apple Provisioning Profile?` と聞かれたら **Yes (Y)** を選んで再生成させてください。
- **バージョン重複エラー**:
  - App Store Connectに同じバージョン+ビルド番号が既に存在する場合、アップロードに失敗します。`app.json` の `buildNumber` を上げるか、EASのRemote Version管理を使用してください。
