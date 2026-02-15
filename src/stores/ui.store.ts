import { create } from "zustand";

type Tab = "search" | "queue" | "history";

interface UIStore {
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  activeTab: "search",
  setActiveTab: (tab) => set({ activeTab: tab }),
}));
