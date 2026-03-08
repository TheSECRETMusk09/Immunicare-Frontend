import { create } from "zustand";
import { apiClient } from "../utils/api";

const useDataStore = create((set, get) => ({
  infants: [],
  dashboardStats: null,
  loading: false,
  error: null,

  // Infants
  fetchInfants: async () => {
    set({ loading: true, error: null });
    try {
      const infants = await apiClient.getInfants();
      set({ infants, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addInfant: async (infantData) => {
    try {
      const newInfant = await apiClient.createInfant(infantData);
      set((state) => ({ infants: [...state.infants, newInfant] }));
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  updateInfant: async (id, infantData) => {
    try {
      const updatedInfant = await apiClient.updateInfant(id, infantData);
      set((state) => ({
        infants: state.infants.map((infant) =>
          infant.id === id ? updatedInfant : infant,
        ),
      }));
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  deleteInfant: async (id) => {
    try {
      await apiClient.deleteInfant(id);
      set((state) => ({
        infants: state.infants.filter((infant) => infant.id !== id),
      }));
      return { success: true };
    } catch (error) {
      set({ error: error.message });
      return { success: false, error: error.message };
    }
  },

  // Dashboard
  fetchDashboardStats: async () => {
    set({ loading: true, error: null });
    try {
      const stats = await apiClient.getDashboardStats();
      set({ dashboardStats: stats, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}));

export default useDataStore;
