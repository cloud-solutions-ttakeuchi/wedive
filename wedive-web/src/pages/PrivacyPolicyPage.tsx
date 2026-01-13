import React from 'react';
import { useNavigate } from 'react-router-dom';

const PrivacyPolicyPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full bg-white shadow sm:rounded-lg p-8">
        <div className="mb-6">
          <button
            onClick={() => navigate('/')}
            className="text-blue-600 hover:text-blue-800 font-medium flex items-center"
          >
            ← ホームに戻る
          </button>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-8 text-center">プライバシーポリシー</h1>

        <div className="prose prose-blue max-w-none text-gray-700 space-y-6">
          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">1. はじめに</h2>
            <p>
              WeDive（以下「本アプリ」）は、ユーザーの個人情報の保護を重要視しています。本プライバシーポリシーでは、本アプリがどのような情報を収集し、それをどのように使用するかについて説明します。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">2. 収集する情報</h2>
            <p>本アプリは、以下の情報を収集することがあります：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>アカウント情報（メールアドレス、ユーザー名など）</li>
              <li>ダイビングログデータ（日付、場所、写真、コメントなど）</li>
              <li>アプリの利用状況データ（クラッシュレポート、パフォーマンスデータなど）</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">3. 情報の利用目的</h2>
            <p>収集した情報は、以下の目的で利用されます：</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>サービスの提供および維持</li>
              <li>ユーザー認証およびアカウント管理</li>
              <li>新機能の開発およびサービスの改善</li>
              <li>お問い合わせへの対応</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">4. アカウントの削除</h2>
            <p>
              ユーザーはいつでもアカウント削除を申請することができます。アカウントが削除されると、関連する個人データはシステムから完全に消去されます。
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 mb-2">5. お問い合わせ</h2>
            <p>
              プライバシーポリシーに関するご質問は、下記までお問い合わせください。<br />
              <a href="/support" className="text-blue-600 hover:underline">お問い合わせページへ</a>
            </p>
          </section>

          <div className="pt-8 text-sm text-gray-500 border-t mt-8 text-center">
            &copy; {new Date().getFullYear()} WeDive. All rights reserved.
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
