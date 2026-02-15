"use client";

import { X, Film, Tv, HardDrive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/shared/progress-bar";
import { QueueItem } from "@/stores/queue.store";

interface QueueItemComponentProps {
  item: QueueItem;
  onCancel?: (id: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function QueueItemComponent({
  item,
  onCancel,
}: QueueItemComponentProps) {
  const isDownloading = item.status === "downloading";
  const isPending = item.status === "pending";
  const isSeries = item.itemType === "series" && (item.seasonNumber !== undefined || item.episodeNumber !== undefined);

  const getStatusBadge = () => {
    switch (item.status) {
      case "pending":
        return <Badge variant="secondary">En espera</Badge>;
      case "downloading":
        return <Badge variant="default">Descargando</Badge>;
      case "paused":
        return <Badge variant="secondary">Pausado</Badge>;
      case "completed":
        return <Badge variant="default">Completado</Badge>;
      case "error":
        return <Badge variant="destructive">Error</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-16 w-12 shrink-0 items-center justify-center rounded bg-muted">
          {item.itemType === "movie" ? (
            <Film className="h-6 w-6 text-muted-foreground" />
          ) : (
            <Tv className="h-6 w-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="truncate font-semibold">{item.itemTitle}</h3>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            {isSeries && item.seasonNumber !== undefined && (
              <span>Temporada {item.seasonNumber}</span>
            )}
            {isSeries && item.episodeNumber !== undefined && (
              <span>Episodio {item.episodeNumber}</span>
            )}
            {getStatusBadge()}
          </div>
        </div>
        {/* Cancel button on the right */}
        {(isPending || isDownloading) && (
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => onCancel?.(item.id)}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Show progress bar for downloading items with progress > 0 */}
      {isDownloading && item.progress > 0 && (
        <ProgressBar progress={item.progress} />
      )}

      {/* Show size info if available */}
      {item.size !== undefined && item.size > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <HardDrive className="h-3 w-3" />
          <span>{formatBytes(item.size)}</span>
        </div>
      )}

      {item.error && (
        <p className="text-sm text-destructive">{item.error}</p>
      )}
    </div>
  );
}
