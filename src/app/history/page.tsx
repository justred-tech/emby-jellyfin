"use client";

import { useEffect, useState } from "react";
import { HistoryList, type HistoryItem } from "@/components/history/history-list";

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch("/api/downloads/history");
        if (!response.ok) throw new Error("Failed to fetch history");
        const data = await response.json();
        setItems(data);
      } catch (error) {
        console.error("Error fetching history:", error);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col gap-6">
        <h2 className="text-xl font-semibold">Historial de descargas</h2>
        <HistoryList items={items} />
      </div>
    </div>
  );
}
