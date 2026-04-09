import React, { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './LocalAuthWrapper';
import { getAccessToken, isTokenExpired, clearAuthAndRedirectToLogin } from '../../api/apiUtils';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: ('admin' | 'moderator' | 'accountant' | 'ADMIN' | 'MODERATOR' | 'ACCOUNTANT')[];
  fallbackPath?: string;
}
export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  fallbackPath = '/unauthorized'
}) => {
  const { user, isAuthenticated, loading } = useAuth();

  // If token exists but is expired (exp in the past), clear auth and redirect to login
  useEffect(() => {
    const token = getAccessToken();
    if (token && isTokenExpired(token)) {
      clearAuthAndRedirectToLogin();
    }
  }, []);

  // Show loading while checking authentication
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }
  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  // Check role-based access if allowedRoles is specified
  if (allowedRoles && user) {
    const hasRequiredRole = allowedRoles.includes(user.role as 'admin' | 'moderator' | 'accountant');
    if (!hasRequiredRole && user.role !== 'admin' && user.role !== 'moderator' && user.role !== 'accountant') {
      return <Navigate to={fallbackPath} replace />;
    }
  }
  // Render children if all checks pass
  return <>{children}</>;
};
// Default export for lazy loading
export default ProtectedRoute;