import { create } from "zustand";
import { apiClient } from "../utils/api";

const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem("token") || null,
  isAuthenticated: !!localStorage.getItem("token"),
  loading: false,
  error: null,

  login: async (credentials) => {
    set({ loading: true, error: null });
    try {
      const response = await apiClient.login(credentials);
      const token = response.token || localStorage.getItem("token"); // Assuming login sets token in localStorage or returns it
      const user = response.user;
      localStorage.setItem("token", token);
      set({ user, token, isAuthenticated: true, loading: false });
      return { success: true };
    } catch (error) {
      set({ error: error.message, loading: false });
      return { success: false, error: error.message };
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    set({ user: null, token: null, isAuthenticated: false });
  },

  refreshToken: async () => {
    try {
      const response = await apiClient.request("/auth/refresh", {
        method: "POST",
      });
      const newToken = response.token;
      localStorage.setItem("token", newToken);
      set({ token: newToken });
      return { success: true };
    } catch (error) {
      get().logout();
      return { success: false };
    }
  },

  setUser: (user) => set({ user }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));

export default useAuthStore;
