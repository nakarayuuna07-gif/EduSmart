import { useEffect, type ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth.tsx';
import { PageSkeleton } from './LoadingSkeleton.tsx';

interface ProtectedRouteProps {
  children: ReactNode;
  onRedirectToLogin: () => void;
}

export function ProtectedRoute({
  children,
  onRedirectToLogin,
}: ProtectedRouteProps) {
  const { user, authReady } = useAuth();

  useEffect(() => {
    if (authReady && !user) {
      onRedirectToLogin();
    }
  }, [authReady, user, onRedirectToLogin]);

  if (!authReady) {
    return <PageSkeleton />;
  }

  if (!user) {
    return <PageSkeleton />;
  }

  return <>{children}</>;
}
