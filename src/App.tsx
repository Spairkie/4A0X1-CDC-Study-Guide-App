import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useNavigate } from 'react-router-dom';
import { Layout }      from './components/layout/Layout';
import { Home }        from './pages/Home';
import { Modules }     from './pages/Modules';
import { ModuleDetail } from './pages/ModuleDetail';
import { QuizLauncher } from './pages/QuizLauncher';
import { SessionPage }  from './pages/SessionPage';
import { ResultsPage }  from './pages/ResultsPage';
import { Missed }       from './pages/Missed';
import { ReviewPage }   from './pages/ReviewPage';
import { useTheme }     from './hooks/useTheme';

// Lazy-load heavy pages to reduce the initial bundle
const Stats    = lazy(() => import('./pages/Stats').then(m => ({ default: m.Stats })));
const Settings = lazy(() => import('./pages/Settings').then(m => ({ default: m.Settings })));

// ─── Error Boundary ────────────────────────────────────────────────────────

interface ErrorBoundaryState { hasError: boolean; message: string }

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error?.message ?? 'Unknown error' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-subtle flex items-center justify-center p-6">
          <div className="bg-surface border border-red-200 dark:border-red-800 rounded-2xl p-6 max-w-md w-full text-center shadow-lg">
            <div className="text-4xl mb-4">⚠️</div>
            <h2 className="font-display font-bold text-lg text-app mb-2">Something went wrong</h2>
            <p className="text-muted text-sm mb-4">{this.state.message}</p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-indigo-500 text-white font-display font-semibold text-sm hover:bg-indigo-600 transition-colors"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Page suspense fallback ────────────────────────────────────────────────

const PageSkeleton: React.FC = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="h-6 w-6 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin" aria-label="Loading" />
  </div>
);

// ─── 404 page ─────────────────────────────────────────────────────────────

const NotFound: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-subtle flex items-center justify-center p-6">
      <div className="bg-surface border border-border rounded-2xl p-8 max-w-md w-full text-center shadow-lg">
        <div className="text-5xl mb-4">🔍</div>
        <h2 className="font-display font-bold text-xl text-app mb-2">Page Not Found</h2>
        <p className="text-muted text-sm mb-6">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-xl bg-indigo-500 text-white font-display font-semibold text-sm hover:bg-indigo-600 transition-colors"
        >
          Go Home
        </button>
      </div>
    </div>
  );
};

// ─── Routes ───────────────────────────────────────────────────────────────

const AppRoutes: React.FC = () => {
  useTheme();
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/"                 element={<Home />} />
        <Route path="/modules"          element={<Modules />} />
        <Route path="/modules/:routeId" element={<ModuleDetail />} />
        <Route path="/quiz"             element={<QuizLauncher />} />
        <Route path="/missed"           element={<Missed />} />
        <Route path="/review"           element={<ReviewPage />} />
        <Route path="/stats"            element={
          <Suspense fallback={<PageSkeleton />}><Stats /></Suspense>
        } />
        <Route path="/settings"         element={
          <Suspense fallback={<PageSkeleton />}><Settings /></Suspense>
        } />
      </Route>
      {/* Full-screen pages — no nav chrome */}
      <Route path="/session" element={<SessionPage />} />
      <Route path="/results" element={<ResultsPage />} />
      {/* Catch-all 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export const App: React.FC = () => (
  <BrowserRouter>
    <ErrorBoundary>
      <AppRoutes />
    </ErrorBoundary>
  </BrowserRouter>
);
