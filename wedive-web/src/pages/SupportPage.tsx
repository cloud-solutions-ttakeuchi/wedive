import React from 'react';
import { useNavigate } from 'react-router-dom';

const SupportPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full bg-white shadow sm:rounded-lg p-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
          >
            ← ホームに戻る
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">お問い合わせ (support)</h1>

        <div className="text-gray-700 space-y-6">
          <p className="text-lg leading-relaxed">
            WeDiveをご利用いただきありがとうございます。<br />
            アプリの使い方に関するご質問、不具合の報告、機能のご要望などがございましたら、以下のメールアドレスまでご連絡ください。
          </p>

          <div className="bg-blue-50 border border-blue-100 rounded-lg p-6 text-center">
            <p className="text-sm text-blue-800 mb-2 font-bold">お問い合わせ窓口</p>
            <a
              href="mailto:support@wedive.app"
              className="text-2xl font-bold text-blue-600 hover:text-blue-800 break-all"
            >
              support@wedive.app
            </a>
            <p className="text-xs text-gray-500 mt-2">
              ※ 現在、順次対応中のため返信にお時間をいただく場合がございます。
            </p>
          </div>

          <div className="border-t pt-6 mt-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">よくある質問</h2>
            <ul className="space-y-4">
              <li className="bg-gray-50 p-4 rounded-lg">
                <p className="font-bold text-gray-800 mb-1">Q. ログデータはバックアップされていますか？</p>
                <p className="text-gray-600 text-sm">A. はい、ログインしてご利用いただければ、データはクラウド上に安全に保存されます。</p>
              </li>
              <li className="bg-gray-50 p-4 rounded-lg">
                <p className="font-bold text-gray-800 mb-1">Q. 機種変更時の引き継ぎは？</p>
                <p className="text-gray-600 text-sm">A. 新しい端末で同じアカウント（メールアドレス、Google、Apple）でログインするだけで、データが引き継がれます。</p>
              </li>
            </ul>
          </div>

          <div className="pt-8 text-sm text-gray-500 text-center">
            &copy; {new Date().getFullYear()} WeDive. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default SupportPage;
