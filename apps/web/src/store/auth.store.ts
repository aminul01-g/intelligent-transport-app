import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { User } from '../types/user';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setAuth: (user: User, token: string) => void;
  clearAuth: () => void;
  setLoading: (isLoading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      isAuthenticated: false,
      isLoading: false,
      setAuth: (user, token) => {
        set({
          user,
          accessToken: token,
          isAuthenticated: true,
          isLoading: false,
        });
      },
      clearAuth: () => {
        set({
          user: null,
          accessToken: null,
          isAuthenticated: false,
          isLoading: false,
        });
      },
      setLoading: (isLoading) => {
        set({ isLoading });
      },
    }),
    {
      name: 'transport-auth-store',
      storage: createJSONStorage(() => localStorage),
      // Persist ONLY the accessToken to localStorage
      partialize: (state) => ({
        accessToken: state.accessToken,
      }),
      // Rehydrate user status appropriately based on persisted token
      onRehydrateStorage: () => (state) => {
        if (state && state.accessToken) {
          /* eslint-disable no-param-reassign */
          state.isAuthenticated = true;
          /* eslint-enable no-param-reassign */
        }
      },
    },
  ),
);
