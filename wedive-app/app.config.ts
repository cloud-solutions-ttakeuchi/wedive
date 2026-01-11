import 'dotenv/config';
import { ExpoConfig, ConfigContext } from 'expo/config';

export default ({ config }: ConfigContext): ExpoConfig => {
  const APP_VARIANT = process.env.APP_VARIANT;

  // APP_VARIANTに応じてアプリ名やIDを切り替える
  // 未設定時は元の app.json (開発環境) の値をデフォルトにする
  const getName = () => {
    switch (APP_VARIANT) {
      case 'production': return "WeDive";
      case 'staging': return "WeDive (Stg)";
      default: return process.env.APP_NAME || "wedive-app";
    }
  };

  const getIdentifier = () => {
    switch (APP_VARIANT) {
      case 'production': return "com.wedive.app";
      case 'staging': return "com.wedive.stg";
      default: return "com.wedive.dev";
    }
  };

  const getScheme = () => {
    switch (APP_VARIANT) {
      case 'production': return "wedive-app";
      case 'staging': return "wedive-app-stg";
      default: return "wedive-app"; // 元のapp.jsonに合わせてデフォルトはwediveappに
    }
  };

  // Determine iOS Client ID: use WEB_CLIENT_ID (which is used for everything in this project)
  const associatedIosClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  // Determine iOS URL Scheme: specific var -> derived from client ID -> dev fallback
  // Determine iOS URL Scheme: derived from client ID -> dev fallback
  const getIosUrlScheme = (clientId: string) => {
    // Attempt to derive scheme from Client ID (reverse DNS for Google IDs)
    // Client ID: XXXXX.apps.googleusercontent.com -> Scheme: com.googleusercontent.apps.XXXXX
    if (clientId) {
      const match = clientId.match(/^([^.]+)\.apps\.googleusercontent\.com$/);
      if (match && match[1]) {
        return `com.googleusercontent.apps.${match[1]}`;
      }
    }
    // 環境変数設定漏れなどでClient IDが不正/不在の場合はエラーを投げる（隠蔽しない）
    throw new Error("Failed to generate iOS URL Scheme. EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID or EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID matching *.apps.googleusercontent.com is required.");
  };

  return {
    ...config,
    name: getName(),
    slug: "wedive-app",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/icon.png",
    scheme: getScheme(),
    userInterfaceStyle: "automatic",
    newArchEnabled: true,
    splash: {
      image: "./assets/images/splash-icon.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: getIdentifier(),
      infoPlist: {
        ITSAppUsesNonExemptEncryption: false
      }
    },
    android: {
      package: getIdentifier(),
      adaptiveIcon: {
        foregroundImage: "./assets/images/adaptive-icon.png",
        backgroundColor: "#ffffff"
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false
    },
    web: {
      bundler: "metro",
      output: "static",
      favicon: "./assets/images/favicon.png"
    },
    plugins: [
      "expo-asset",
      "expo-sqlite",
      "expo-router",
      "expo-image-picker",
      "@react-native-community/datetimepicker",
      [
        "@react-native-google-signin/google-signin",
        {
          iosClientId: associatedIosClientId,
          iosUrlScheme: getIosUrlScheme(associatedIosClientId)
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    },
    extra: {
      variant: APP_VARIANT,
      // EASプロジェクトID等が必要な場合は環境変数から読み込む
      eas: {
        projectId: process.env.EAS_PROJECT_ID || "dfe6116c-6a22-409a-8701-2b041a6e7310"
      }
    }
  };
};
