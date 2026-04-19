import { useAuthStore } from '@/stores/auth-store';

export function useAuth() {
  const { user, isAuthenticated, isLoading } = useAuthStore();
  
  // Get token from localStorage
  const token =
    typeof window !== 'undefined'
      ? localStorage.getItem('accessToken') || localStorage.getItem('token')
      : null;
  
  return {
    user,
    token,
    isAuthenticated,
    isLoading,
  };
}
