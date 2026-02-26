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

function formatEta(seconds?: number): string {
  if (seconds === undefined || !isFinite(seconds) || seconds <= 0) return 'calculando...';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function humanizeError(error?: string): string | undefined {
  if (!error) return undefined;
  if (error.includes('401')) return 'Error de autenticación con Emby (401). Se reintentará con token nuevo.';
  if (error.includes('403')) return 'Emby denegó acceso al archivo (403).';
  if (error.includes('Archivo inválido o incompleto')) return 'Emby devolvió un archivo inválido (muy pequeño).';
  if (error.includes('Ya existe en cola o completado')) return 'Ya está en cola o ya existe una descarga válida.';
  return error;
}

export function QueueItemComponent({
  item,
  onCancel,
}: QueueItemComponentProps) {
  const isDownloading = item.status === "downloading";
  const isPending = item.status === "pending";
  const isSeries = item.itemType === "series" && (item.seasonNumber !== undefined || item.episodeNumber !== undefined);
  const canRemove = item.status !== "completed";

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
        {canRemove && (
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

      {/* Show downloaded / total */}
      {isDownloading && item.totalBytes !== undefined && item.totalBytes > 0 && (
        <div className="flex flex-col gap-1 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <HardDrive className="h-3 w-3" />
            <span>
              {formatBytes(item.downloadedBytes ?? 0)} / {formatBytes(item.totalBytes)}
            </span>
          </div>
          <div>
            Velocidad: {formatBytes(item.speedBytesPerSec ?? 0)}/s · ETA: {formatEta(item.etaSeconds)}
          </div>
        </div>
      )}

      {/* Show total size info if available */}
      {!isDownloading && item.size !== undefined && item.size > 0 && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <HardDrive className="h-3 w-3" />
          <span>{formatBytes(item.size)}</span>
        </div>
      )}

      {item.error && (
        <div className="text-sm text-destructive">
          <p>{humanizeError(item.error)}</p>
          <p className="mt-1 text-xs opacity-80">Detalle técnico: {item.error}</p>
        </div>
      )}
    </div>
  );
}
