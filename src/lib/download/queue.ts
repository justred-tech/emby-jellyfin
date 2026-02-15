/**
 * Gestor de cola de descargas
 * Procesa la cola de descargas de forma secuencial (una a la vez)
 */

import { randomUUID } from 'crypto';
import { unlinkSync, rmdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import {
  getQueue,
  addToQueue,
  updateQueueItem,
  removeFromQueue,
  getNextPendingItem,
  completeDownload,
  getQueueItem,
  type DownloadQueueItem,
} from '../db';
import { downloadManager } from './downloader';
import { progressEmitter } from '../progress/emitter';
import { getItem, getDownloadUrl } from '../emby/client';
import type { DownloadProgress, DownloadStatus } from './downloader';

/**
 * Elimina el archivo físico y el directorio si está vacío
 */
function deleteDownloadFile(filePath: string): void {
  try {
    if (existsSync(filePath)) {
      unlinkSync(filePath);
      console.log(`Archivo eliminado: ${filePath}`);

      // Intentar eliminar el directorio padre si está vacío
      const parentDir = dirname(filePath);
      try {
        const files = require('fs').readdirSync(parentDir);
        if (files.length === 0) {
          rmdirSync(parentDir);
          console.log(`Directorio vacío eliminado: ${parentDir}`);
        }
      } catch {
        // Directorio no vacío o error, ignorar
      }
    }
  } catch (error) {
    console.error(`Error al eliminar archivo ${filePath}:`, error);
  }
}

/**
 * Estado del procesador de cola
 */
type QueueProcessorStatus = 'idle' | 'processing' | 'paused';

/**
 * Procesador de cola de descargas
 */
class QueueProcessor {
  private status: QueueProcessorStatus = 'idle';
  private processingId: string | null = null;

  /**
   * Inicia el procesamiento de la cola
   */
  async start(): Promise<void> {
    if (this.status === 'processing') {
      console.log('El procesador de cola ya está en ejecución');
      return;
    }

    this.status = 'processing';
    console.log('Iniciando procesador de cola de descargas');

    this.processNext();
  }

  /**
   * Procesa el siguiente item pendiente
   */
  private async processNext(): Promise<void> {
    // Verificar si hay una descarga activa
    if (this.processingId) {
      console.log(`Ya se está procesando la descarga ${this.processingId}`);
      return;
    }

    // Solo permitir una descarga a la vez
    if (downloadManager.getActiveCount() >= downloadManager.getMaxConcurrent()) {
      console.log('Número máximo de descargas concurrentes alcanzado');
      return;
    }

    // Obtener el siguiente item pendiente
    const nextItem = getNextPendingItem();
    if (!nextItem) {
      console.log('No hay items pendientes en la cola');
      this.status = 'idle';
      return;
    }

    // Procesar el item
    await this.processItem(nextItem);
  }

  /**
   * Procesa un item de la cola
   */
  private async processItem(item: DownloadQueueItem): Promise<void> {
    this.processingId = item.id;

    // Actualizar estado a descargando
    updateQueueItem(item.id, {
      status: 'downloading',
      started_at: Date.now(),
    });

    progressEmitter.emit('queue', {
      type: 'status',
      id: item.id,
      status: 'downloading',
    });

    try {
      // Obtener información adicional del item si es necesario
      const embyItem = await getItem(item.emby_item_id);
      const container = embyItem.Container || 'mkv';

      // Calcular la ruta de destino antes de iniciar la descarga
      const downloadType: 'movie' | 'episode' = item.type === 'movie' ? 'movie' : 'episode';
      const { getDestinationPath } = await import('./organizer');
      const destination = await getDestinationPath(
        downloadType,
        item.series_id ? (embyItem.SeriesName || item.emby_item_name) : item.emby_item_name,
        item.year,
        item.season_number,
        item.episode_number,
        item.type === 'episode' ? embyItem.Name : item.emby_item_name,
        container
      );

      // Actualizar la ruta de destino en la base de datos
      updateQueueItem(item.id, {
        destination_path: destination.fullPath,
      });

      // Iniciar la descarga
      await downloadManager.start(
        {
          id: item.id,
          url: item.download_url,
          type: downloadType,
          name: item.emby_item_name,
          year: item.year,
          seriesName: item.series_id ? embyItem.SeriesName : undefined,
          seasonNumber: item.season_number,
          episodeNumber: item.episode_number,
          episodeTitle: item.type === 'episode' ? embyItem.Name : undefined,
          container,
        },
        {
          onProgress: (progress: DownloadProgress) => {
            this.handleProgress(item.id, progress);
          },
          onComplete: (path: string) => {
            this.handleComplete(item.id, path);
          },
          onError: (error: Error) => {
            this.handleError(item.id, error);
          },
        }
      );
    } catch (error) {
      this.handleError(item.id, error as Error);
    }
  }

  /**
   * Maneja las actualizaciones de progreso
   */
  private handleProgress(id: string, progress: DownloadProgress): void {
    // Actualizar en la base de datos
    updateQueueItem(id, {
      progress: progress.progress,
      downloaded_bytes: progress.downloadedBytes,
      total_bytes: progress.totalBytes,
    });

    // Emitir evento de progreso
    progressEmitter.emit('download', {
      id,
      progress: progress.progress,
      downloadedBytes: progress.downloadedBytes,
      totalBytes: progress.totalBytes,
      speed: progress.speed,
      eta: progress.eta,
      status: progress.status,
    });
  }

  /**
   * Maneja la completitud de una descarga
   */
  private handleComplete(id: string, path: string): void {
    console.log(`Descarga completada: ${id} -> ${path}`);

    // Actualizar en la base de datos
    updateQueueItem(id, {
      status: 'completed',
      progress: 1,
      completed_at: Date.now(),
    });

    // Mover al historial
    completeDownload(id);

    // Emitir evento
    progressEmitter.emit('download', {
      id,
      status: 'completed',
      progress: 1,
    });

    // Limpiar el item actual y procesar el siguiente
    this.processingId = null;

    // Esperar un momento antes de procesar el siguiente
    setTimeout(() => {
      this.processNext();
    }, 1000);
  }

  /**
   * Maneja errores durante la descarga
   */
  private handleError(id: string, error: Error): void {
    console.error(`Error en descarga ${id}:`, error.message);

    // Actualizar en la base de datos
    updateQueueItem(id, {
      status: 'error',
      error_message: error.message,
    });

    // Emitir evento
    progressEmitter.emit('download', {
      id,
      status: 'error',
      error: error.message,
    });

    // Limpiar el item actual y procesar el siguiente
    this.processingId = null;

    // Esperar un momento antes de procesar el siguiente
    setTimeout(() => {
      this.processNext();
    }, 5000); // Esperar más tiempo en caso de error
  }

  /**
   * Pausa el procesamiento de la cola
   */
  pause(): void {
    this.status = 'paused';
    console.log('Procesador de cola pausado');
  }

  /**
   * Reanuda el procesamiento de la cola
   */
  resume(): void {
    if (this.status === 'paused') {
      this.status = 'processing';
      console.log('Procesador de cola reanudado');
      this.processNext();
    }
  }

  /**
   * Detiene el procesamiento de la cola
   */
  stop(): void {
    this.status = 'idle';
    downloadManager.cancelAll();
    this.processingId = null;
    console.log('Procesador de cola detenido');
  }

  /**
   * Cancela una descarga específica
   */
  cancelDownload(id: string): boolean {
    // Si es la descarga actual, cancelarla
    if (this.processingId === id) {
      const item = getQueueItem(id);

      downloadManager.cancel(id);
      this.processingId = null;

      // Eliminar el archivo físico si existe
      if (item?.destination_path) {
        deleteDownloadFile(item.destination_path);
      }

      // Actualizar estado
      updateQueueItem(id, {
        status: 'cancelled',
        completed_at: Date.now(),
      });

      // Mover al historial
      completeDownload(id);

      // Emitir evento
      progressEmitter.emit('download', {
        id,
        status: 'cancelled',
      });

      // Procesar el siguiente
      setTimeout(() => {
        this.processNext();
      }, 1000);

      return true;
    }

    // Si no es la actual, actualizar estado en cola
    const item = getQueueItem(id);
    if (item && (item.status === 'pending' || item.status === 'paused' || item.status === 'downloading')) {
      // Eliminar el archivo físico si existe
      if (item.destination_path) {
        deleteDownloadFile(item.destination_path);
      }

      updateQueueItem(id, {
        status: 'cancelled',
        completed_at: Date.now(),
      });

      completeDownload(id);

      progressEmitter.emit('download', {
        id,
        status: 'cancelled',
      });

      return true;
    }

    return false;
  }

  /**
   * Pausa una descarga específica
   */
  pauseDownload(id: string): boolean {
    // Si es la descarga actual, cancelarla (se retomará después)
    if (this.processingId === id) {
      downloadManager.cancel(id);
      this.processingId = null;

      updateQueueItem(id, {
        status: 'paused',
      });

      progressEmitter.emit('download', {
        id,
        status: 'paused',
      });

      // Procesar el siguiente
      setTimeout(() => {
        this.processNext();
      }, 1000);

      return true;
    }

    return false;
  }

  /**
   * Obtiene el estado del procesador
   */
  getStatus(): QueueProcessorStatus {
    return this.status;
  }

  /**
   * Obtiene el ID del item que se está procesando
   */
  getProcessingId(): string | null {
    return this.processingId;
  }
}

// Instancia singleton del procesador de cola
export const queueProcessor = new QueueProcessor();

/**
 * Añade una película a la cola de descargas
 */
export async function addMovieToQueue(
  embyItemId: string,
  embyItemName: string,
  year: number,
  downloadUrl: string
): Promise<string> {
  const id = randomUUID();

  const item = addToQueue({
    id,
    emby_item_id: embyItemId,
    emby_item_name: embyItemName,
    type: 'movie',
    year,
    status: 'pending',
    download_url: downloadUrl,
    destination_path: '', // Se calculará al descargar
    priority: 0,
  });

  progressEmitter.emit('queue', {
    type: 'added',
    item,
  });

  // Si el procesador está inactivo, iniciarlo
  if (queueProcessor.getStatus() === 'idle') {
    queueProcessor.start();
  }

  return id;
}

/**
 * Añade un episodio a la cola de descargas
 */
export async function addEpisodeToQueue(
  embyItemId: string,
  embyItemName: string,
  seriesId: string,
  seriesName: string,
  seasonNumber: number,
  episodeNumber: number,
  downloadUrl: string
): Promise<string> {
  const id = randomUUID();

  const item = addToQueue({
    id,
    emby_item_id: embyItemId,
    emby_item_name: embyItemName,
    type: 'episode',
    series_id: seriesId,
    season_number: seasonNumber,
    episode_number: episodeNumber,
    status: 'pending',
    download_url: downloadUrl,
    destination_path: '', // Se calculará al descargar
    priority: 0,
  });

  progressEmitter.emit('queue', {
    type: 'added',
    item,
  });

  // Si el procesador está inactivo, iniciarlo
  if (queueProcessor.getStatus() === 'idle') {
    queueProcessor.start();
  }

  return id;
}

/**
 * Añade una temporada completa a la cola de descargas
 */
export async function addSeasonToQueue(
  seriesId: string,
  seriesName: string,
  seasonNumber: number,
  episodeIds: string[]
): Promise<string[]> {
  const config = {
    host: process.env.EMBY_HOST || '',
    apiKey: process.env.EMBY_API_KEY || '',
  };

  const ids: string[] = [];

  for (const episodeId of episodeIds) {
    const downloadUrl = getDownloadUrl(episodeId, config);

    const id = await addEpisodeToQueue(
      episodeId,
      `${seriesName} S${seasonNumber.toString().padStart(2, '0')}`,
      seriesId,
      seriesName,
      seasonNumber,
      0, // Se actualizará con el número real
      downloadUrl
    );

    ids.push(id);
  }

  return ids;
}

/**
 * Obtiene la cola de descargas actual
 */
export function getDownloadQueue(): DownloadQueueItem[] {
  return getQueue();
}

/**
 * Cancela una descarga
 */
export function cancelQueuedDownload(id: string): boolean {
  return queueProcessor.cancelDownload(id);
}

/**
 * Pausa una descarga
 */
export function pauseQueuedDownload(id: string): boolean {
  return queueProcessor.pauseDownload(id);
}
