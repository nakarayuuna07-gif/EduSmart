import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { PageSkeleton } from './components/LoadingSkeleton.tsx';
import { Navbar } from './components/Navbar.tsx';
import { ProtectedRoute } from './components/ProtectedRoute.tsx';
import { AuthProvider } from './hooks/useAuth.tsx';
import type { QuizEvaluationResult } from './types/index.ts';

const LandingPage = lazy(() =>
  import('./pages/LandingPage.tsx').then((m) => ({ default: m.LandingPage })),
);
const LoginPage = lazy(() =>
  import('./pages/AuthPages.tsx').then((m) => ({ default: m.LoginPage })),
);
const RegisterPage = lazy(() =>
  import('./pages/AuthPages.tsx').then((m) => ({ default: m.RegisterPage })),
);
const DashboardPage = lazy(() =>
  import('./pages/DashboardPage.tsx').then((m) => ({ default: m.DashboardPage })),
);
const TutorPage = lazy(() =>
  import('./pages/TutorPage.tsx').then((m) => ({ default: m.TutorPage })),
);
const SummarizePage = lazy(() =>
  import('./pages/SummarizePage.tsx').then((m) => ({ default: m.SummarizePage })),
);
const QuizPage = lazy(() =>
  import('./pages/QuizPage.tsx').then((m) => ({ default: m.QuizPage })),
);
const QuizResultPage = lazy(() =>
  import('./pages/QuizResultPage.tsx').then((m) => ({ default: m.QuizResultPage })),
);
const HistoryPage = lazy(() =>
  import('./pages/HistoryPage.tsx').then((m) => ({ default: m.HistoryPage })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage.tsx').then((m) => ({ default: m.ProfilePage })),
);
const PricingPage = lazy(() =>
  import('./pages/PricingPage.tsx').then((m) => ({ default: m.PricingPage })),
);
const AdminProvidersPage = lazy(() =>
  import('./pages/AdminProvidersPage.tsx').then((m) => ({
    default: m.AdminProvidersPage,
  })),
);

function AppRouter() {
  const [fullPath, setFullPath] = useState<string>(
    () => `${window.location.pathname}${window.location.search}`,
  );
  const [lastQuizResult, setLastQuizResult] = useState<{
    id: string;
    result: QuizEvaluationResult;
  } | null>(null);

  useEffect(() => {
    const onPopState = () => {
      setFullPath(`${window.location.pathname}${window.location.search}`);
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const navigate = useCallback((target: string) => {
    if (target !== `${window.location.pathname}${window.location.search}`) {
      window.history.pushState({}, '', target);
      setFullPath(target);
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, []);

  const redirectToLogin = useCallback(() => {
    navigate('/masuk');
  }, [navigate]);

  const [pathname, searchStr] = fullPath.split('?');
  const searchParams = new URLSearchParams(searchStr || '');
  const chatIdParam = searchParams.get('chatId');

  const renderRoute = () => {
    if (pathname === '/' || pathname === '') {
      return <LandingPage onNavigate={navigate} />;
    }
    if (pathname === '/masuk') {
      return <LoginPage onNavigate={navigate} />;
    }
    if (pathname === '/daftar') {
      return <RegisterPage onNavigate={navigate} />;
    }
    if (pathname === '/dashboard') {
      return (
        <ProtectedRoute onRedirectToLogin={redirectToLogin}>
          <DashboardPage onNavigate={navigate} />
        </ProtectedRoute>
      );
    }
    if (pathname === '/tutor') {
      return (
        <ProtectedRoute onRedirectToLogin={redirectToLogin}>
          <TutorPage initialChatId={chatIdParam} onNavigate={navigate} />
        </ProtectedRoute>
      );
    }
    if (pathname === '/rangkuman') {
      return (
        <ProtectedRoute onRedirectToLogin={redirectToLogin}>
          <SummarizePage onNavigate={navigate} />
        </ProtectedRoute>
      );
    }
    if (pathname === '/kuis') {
      return (
        <ProtectedRoute onRedirectToLogin={redirectToLogin}>
          <QuizPage
            onNavigate={navigate}
            onQuizCompleted={(savedId, result) => {
              setLastQuizResult({ id: savedId, result });
              navigate(`/hasil/${savedId}`);
            }}
          />
        </ProtectedRoute>
      );
    }
    if (pathname.startsWith('/hasil/')) {
      const resultId = pathname.slice('/hasil/'.length);
      const cached =
        lastQuizResult && lastQuizResult.id === resultId
          ? lastQuizResult.result
          : null;
      return (
        <ProtectedRoute onRedirectToLogin={redirectToLogin}>
          <QuizResultPage
            resultId={resultId}
            cachedResult={cached}
            onNavigate={navigate}
          />
        </ProtectedRoute>
      );
    }
    if (pathname === '/riwayat') {
      return (
        <ProtectedRoute onRedirectToLogin={redirectToLogin}>
          <HistoryPage onNavigate={navigate} />
        </ProtectedRoute>
      );
    }
    if (pathname === '/paket') {
      return (
        <ProtectedRoute onRedirectToLogin={redirectToLogin}>
          <PricingPage onNavigate={navigate} />
        </ProtectedRoute>
      );
    }
    if (pathname === '/profil') {
      return (
        <ProtectedRoute onRedirectToLogin={redirectToLogin}>
          <ProfilePage onNavigate={navigate} />
        </ProtectedRoute>
      );
    }
    if (pathname === '/admin' || pathname === '/admin/providers') {
      return (
        <ProtectedRoute onRedirectToLogin={redirectToLogin}>
          <AdminProvidersPage />
        </ProtectedRoute>
      );
    }

    return <LandingPage onNavigate={navigate} />;
  };

  return (
    <div className="min-h-screen bg-white text-ink flex flex-col">
      <Navbar currentPath={pathname} onNavigate={navigate} />
      <main className="flex-1">
        <Suspense fallback={<PageSkeleton />}>{renderRoute()}</Suspense>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppRouter />
    </AuthProvider>
  );
}
