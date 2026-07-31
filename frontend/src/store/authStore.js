import { create } from 'zustand';

const initialState = {
  accessToken: null,
  user: null,
  isRefreshing: false,
  hasTriedBootstrap: false,
};

export const useAuthStore = create((set, get) => ({
  ...initialState,
  setSession: ({ accessToken, user }) => set({ accessToken, user }),
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setRefreshing: (isRefreshing) => set({ isRefreshing }),
  setHasTriedBootstrap: (hasTriedBootstrap) => set({ hasTriedBootstrap }),
  clearSession: () => set({ ...initialState, hasTriedBootstrap: get().hasTriedBootstrap }),
}));

export const getAccessToken = () => useAuthStore.getState().accessToken;
