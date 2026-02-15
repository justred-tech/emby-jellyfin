"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { QueueList } from "@/components/queue/queue-list";
import { QueueItem } from "@/stores/queue.store";

// Database queue item type
interface DbQueueItem {
  id: string;
  emby_item_id: string;
  emby_item_name: string;
  type: 'movie' | 'episode' | 'season' | 'series';
  series_id?: string;
  season_number?: number;
  episode_number?: number;
  year?: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: number;
  downloaded_bytes: number;
  total_bytes?: number;
  error_message?: string;
  added_at: number;
}

// SSE event types from server
interface SSEEvent {
  type: 'download' | 'queue' | 'system';
  data: {
    id?: string;
    progress?: number;
    downloadedBytes?: number;
    totalBytes?: number;
    speed?: number;
    eta?: number;
    status?: string;
    error?: string;
    type?: string;
    item?: DbQueueItem;
  };
  timestamp: number;
}

export default function QueuePage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Map database item to component format
  const mapDbItemToQueueItem = useCallback((dbItem: DbQueueItem): QueueItem => ({
    id: dbItem.id,
    itemId: dbItem.emby_item_id,
    itemTitle: dbItem.emby_item_name,
    itemType: dbItem.type === 'movie' ? 'movie' : 'series',
    seasonNumber: dbItem.season_number ?? undefined,
    episodeNumber: dbItem.episode_number ?? undefined,
    status: dbItem.status === 'cancelled' ? 'error' : dbItem.status,
    progress: Math.round(dbItem.progress * 100),
    size: dbItem.total_bytes,
    error: dbItem.error_message,
    addedAt: new Date(dbItem.added_at),
  }), []);

  const fetchQueue = useCallback(async () => {
    try {
      const response = await fetch("/api/downloads");
      if (!response.ok) throw new Error("Failed to fetch queue");
      const data = await response.json();
      const queueItems = (data.queue || []).map(mapDbItemToQueueItem);
      setItems(queueItems);
    } catch (error) {
      console.error("Error fetching queue:", error);
    }
  }, [mapDbItemToQueueItem]);

  // Connect to SSE
  useEffect(() => {
    fetchQueue();

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const eventSource = new EventSource("/api/downloads/events");
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log("SSE connected");
      };

      eventSource.onmessage = (event) => {
        try {
          const sseEvent: SSEEvent = JSON.parse(event.data);

          if (sseEvent.type === 'download') {
            const { id, progress, status, error } = sseEvent.data;

            if (id) {
              setItems((prev) =>
                prev.map((item) => {
                  if (item.id !== id) return item;

                  const updates: Partial<QueueItem> = {};

                  if (progress !== undefined) {
                    updates.progress = Math.round(progress * 100);
                  }
                  if (status) {
                    updates.status = status as QueueItem['status'];
                  }
                  if (error) {
                    updates.error = error;
                  }

                  return { ...item, ...updates };
                })
              );
            }
          } else if (sseEvent.type === 'queue') {
            // Queue changed - refetch to get updated list
            fetchQueue();
          }
        } catch (e) {
          // Ignore parse errors for keep-alive
        }
      };

      eventSource.onerror = () => {
        console.log("SSE error, reconnecting...");
        eventSource.close();
        setTimeout(connectSSE, 3000);
      };
    };

    connectSSE();

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, [fetchQueue]);

  const handleCancel = async (id: string) => {
    try {
      const response = await fetch(`/api/downloads/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("Failed to cancel");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch (error) {
      console.error("Error canceling download:", error);
    }
  };

  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Cola de descargas</h2>
        </div>
        <QueueList
          items={items}
          onCancel={handleCancel}
        />
      </div>
    </div>
  );
}
