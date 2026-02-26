import { create } from "zustand";

export type QueueItemStatus = "pending" | "downloading" | "paused" | "completed" | "error";

export interface QueueItem {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: "movie" | "series";
  seasonNumber?: number;
  episodeNumber?: number;
  status: QueueItemStatus;
  progress: number;
  size?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speedBytesPerSec?: number;
  etaSeconds?: number;
  error?: string;
  addedAt: Date;
}

interface QueueStore {
  items: QueueItem[];
  addItem: (item: Omit<QueueItem, "id" | "addedAt">) => void;
  updateItem: (id: string, updates: Partial<QueueItem>) => void;
  removeItem: (id: string) => void;
  clearCompleted: () => void;
  setItems: (items: QueueItem[]) => void;
}

export const useQueueStore = create<QueueStore>((set) => ({
  items: [],
  addItem: (item) =>
    set((state) => ({
      items: [
        ...state.items,
        {
          ...item,
          id: crypto.randomUUID(),
          addedAt: new Date(),
        },
      ],
    })),
  updateItem: (id, updates) =>
    set((state) => ({
      items: state.items.map((item) =>
        item.id === id ? { ...item, ...updates } : item
      ),
    })),
  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((item) => item.id !== id),
    })),
  clearCompleted: () =>
    set((state) => ({
      items: state.items.filter((item) => item.status !== "completed"),
    })),
  setItems: (items) => set({ items }),
}));
