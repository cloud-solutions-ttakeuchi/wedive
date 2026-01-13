import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { SpotDetail } from './pages/SpotDetail';
import { CreatureDetailPage } from './pages/CreatureDetailPage';
import { MyPage } from './pages/MyPage';
import { MyPointDetail } from './pages/MyPointDetail';
import { Pokedex } from './pages/Pokedex';
import { AddCreaturePage } from './pages/AddCreaturePage';
import { AddPointPage } from './pages/AddPointPage';
import { AddLogPage } from './pages/AddLogPage';
import { PointSearchPage } from './pages/PointSearchPage';
import { PointDetailPage } from './pages/PointDetailPage';
import { EditLogPage } from './pages/EditLogPage';
import { EditCreaturePage } from './pages/EditCreaturePage';
import { EditPointPage } from './pages/EditPointPage';
import { ProposeCreaturePage } from './pages/ProposeCreaturePage';
import { ProposePointPage } from './pages/ProposePointPage';
import { AdminProposalsPage } from './pages/AdminProposalsPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { AdminAreaCleansingPage } from './pages/AdminAreaCleansingPage';
import { AdminCreatureCleansingPage } from './pages/AdminCreatureCleansingPage';
import { AdminDataCleansingPage } from './pages/AdminDataCleansingPage';
import { PublicLogsPage } from './pages/PublicLogsPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import SupportPage from './pages/SupportPage';
import { ConciergePage } from './pages/ConciergePage';
import { AddReviewPage } from './pages/AddReviewPage';
import { TermsAgreementModal } from './components/TermsAgreementModal';
import { LanguageProvider } from './context/LanguageContext';
import { AuthProvider } from './context/AuthContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 30, // 30 minutes (Local Firstなので長めに)
      refetchOnWindowFocus: false, // タブ切り替えでの再取得を停止
      refetchOnMount: false, // コンポーネントマウント時の再取得を停止
      retry: 1, // 失敗時のリトライ回数削減
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <AppProvider>
            <LanguageProvider>
              <Layout>
                <TermsAgreementModal />
                <Routes>
                  <Route path="/" element={<Home />} />
                  <Route path="/creatures" element={<Pokedex />} />
                  <Route path="/spot/:id" element={<SpotDetail />} />
                  <Route path="/creature/:id" element={<CreatureDetailPage />} />
                  <Route path="/mypage" element={<MyPage />} />
                  <Route path="/mypage/point/:id" element={<MyPointDetail />} />
                  <Route path="/add-creature" element={<AddCreaturePage />} />
                  <Route path="/add-point" element={<AddPointPage />} />
                  <Route path="/add-log" element={<AddLogPage />} />
                  <Route path="/edit-log/:id" element={<EditLogPage />} />
                  <Route path="/edit-creature/:id" element={<EditCreaturePage />} />
                  <Route path="/edit-point/:id" element={<EditPointPage />} />
                  <Route path="/concierge" element={<ConciergePage />} />
                  <Route path="/propose-creature" element={<ProposeCreaturePage />} />
                  <Route path="/propose-point" element={<ProposePointPage />} />
                  <Route path="/admin/proposals" element={<AdminProposalsPage />} />
                  <Route path="/admin/users" element={<AdminUsersPage />} />
                  <Route path="/admin/areas" element={<AdminAreaCleansingPage />} />
                  <Route path="/admin/creatures" element={<AdminCreatureCleansingPage />} />
                  <Route path="/admin/cleansing" element={<AdminDataCleansingPage />} />
                  <Route path="/points" element={<PointSearchPage />} />
                  <Route path="/logs" element={<PublicLogsPage />} />
                  <Route path="/point/:id" element={<PointDetailPage />} />
                  <Route path="/add-review/:pointId/:reviewId?" element={<AddReviewPage />} />
                  <Route path="/edit-review/:reviewId" element={<AddReviewPage />} />
                  <Route path="/terms" element={<TermsPage />} />
                  <Route path="/privacy" element={<PrivacyPage />} />
                  <Route path="/support" element={<SupportPage />} />
                </Routes>
              </Layout>
            </LanguageProvider>
          </AppProvider>
        </AuthProvider>
      </Router>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
