import { Film, Tv, CheckCircle, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { QueueItem } from "@/stores/queue.store";

export interface HistoryItem {
  id: string;
  itemTitle: string;
  itemType: "movie" | "series";
  seasonNumber?: number;
  episodeNumber?: number;
  status: "completed" | "error";
  completedAt: Date;
}

interface HistoryListProps {
  items: HistoryItem[];
}

export function HistoryList({ items }: HistoryListProps) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-center text-muted-foreground">
          No hay descargas en el historial
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center gap-3 rounded-lg border bg-card p-4"
        >
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
              item.status === "completed"
                ? "bg-green-100 text-green-600 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-100 text-red-600 dark:bg-red-900/20 dark:text-red-400"
            }`}
          >
            {item.status === "completed" ? (
              <CheckCircle className="h-5 w-5" />
            ) : (
              <XCircle className="h-5 w-5" />
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h3 className="truncate font-semibold">{item.itemTitle}</h3>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              {item.itemType === "movie" ? (
                <Film className="h-3 w-3" />
              ) : (
                <Tv className="h-3 w-3" />
              )}
              {item.seasonNumber !== undefined && (
                <span>T{item.seasonNumber}</span>
              )}
              {item.episodeNumber !== undefined && (
                <span>E{item.episodeNumber}</span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge
              variant={item.status === "completed" ? "default" : "destructive"}
            >
              {item.status === "completed" ? "Completado" : "Error"}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {new Date(item.completedAt).toLocaleDateString("es-ES", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
