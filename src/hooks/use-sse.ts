"use client";

import { useEffect, useRef, useCallback } from "react";
import { useQueueStore } from "@/stores/queue.store";

type SSEEventType = "progress" | "complete" | "error";

interface SSEProgressEvent {
  type: "progress";
  data: {
    queueId: string;
    progress: number;
  };
}

interface SSECompleteEvent {
  type: "complete";
  data: {
    queueId: string;
  };
}

interface SSEErrorEvent {
  type: "error";
  data: {
    queueId: string;
    error: string;
  };
}

type SSEEvent = SSEProgressEvent | SSECompleteEvent | SSEErrorEvent;

export function useSSE() {
  const eventSourceRef = useRef<EventSource | null>(null);
  const updateItem = useQueueStore((state) => state.updateItem);

  const connect = useCallback(() => {
    if (eventSourceRef.current) {
      return;
    }

    const eventSource = new EventSource("/api/downloads/events");

    eventSource.onopen = () => {
      console.log("SSE connection opened");
    };

    eventSource.onmessage = (event) => {
      try {
        const data: SSEEvent = JSON.parse(event.data);

        switch (data.type) {
          case "progress":
            updateItem(data.data.queueId, {
              progress: data.data.progress,
              status: "downloading",
            });
            break;
          case "complete":
            updateItem(data.data.queueId, {
              status: "completed",
              progress: 100,
            });
            break;
          case "error":
            updateItem(data.data.queueId, {
              status: "error",
              error: data.data.error,
            });
            break;
        }
      } catch (error) {
        console.error("Error parsing SSE event:", error);
      }
    };

    eventSource.onerror = (error) => {
      console.error("SSE error:", error);
      eventSource.close();
      eventSourceRef.current = null;

      // Reconnect after 5 seconds
      setTimeout(() => {
        eventSourceRef.current = null;
        connect();
      }, 5000);
    };

    eventSourceRef.current = eventSource;
  }, [updateItem]);

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  return { connect, disconnect };
}
