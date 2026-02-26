/**
 * Gestor de descargas con seguimiento de progreso
 * Utiliza streams para descargar archivos y reportar progreso
 */

import { createWriteStream, existsSync } from 'fs';
import { stat, rename, unlink } from 'fs/promises';
import { pipeline } from 'stream/promises';
import { join } from 'path';
import { ensureDirectory, getDestinationPath } from './organizer';

/**
 * Estado de una descarga
 */
export type DownloadStatus = 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';

/**
 * Progreso de una descarga
 */
export interface DownloadProgress {
  id: string;
  status: DownloadStatus;
  progress: number; // 0.0 a 1.0
  downloadedBytes: number;
  totalBytes: number | undefined;
  speed: number; // bytes por segundo
  eta: number | undefined; // tiempo estimado en segundos
  error?: string;
}

/**
 * Opciones para una nueva descarga
 */
export interface DownloadOptions {
  id: string;
  url: string;
  type: 'movie' | 'episode' | 'season';
  name: string;
  year?: number;
  seriesName?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  episodeTitle?: string;
  container: string;
  basePath?: string;
}

/**
 * Descarga activa
 */
interface ActiveDownload {
  options: DownloadOptions;
  controller: AbortController;
  startTime: number;
  lastProgressTime: number;
  lastDownloadedBytes: number;
  onProgress?: (progress: DownloadProgress) => void;
  onComplete?: (path: string) => void;
  onError?: (error: Error) => void;
}

/**
 * Gestor de descargas
 */
class DownloadManager {
  private activeDownloads: Map<string, ActiveDownload> = new Map();
  private maxConcurrentDownloads: number = 1;

  /**
   * Inicia una nueva descarga
   */
  async start(
    options: DownloadOptions,
    callbacks?: {
      onProgress?: (progress: DownloadProgress) => void;
      onComplete?: (path: string) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<void> {
    // Verificar si ya existe una descarga activa con el mismo ID
    if (this.activeDownloads.has(options.id)) {
      throw new Error(`Ya existe una descarga activa con ID ${options.id}`);
    }

    const controller = new AbortController();
    const activeDownload: ActiveDownload = {
      options,
      controller,
      startTime: Date.now(),
      lastProgressTime: Date.now(),
      lastDownloadedBytes: 0,
      ...callbacks,
    };

    this.activeDownloads.set(options.id, activeDownload);

    // Iniciar la descarga
    this.performDownload(activeDownload).catch((error) => {
      if (callbacks?.onError) {
        callbacks.onError(error);
      }
    });
  }

  /**
   * Realiza la descarga de un archivo
   */
  private async performDownload(active: ActiveDownload): Promise<string> {
    const { options, controller } = active;
    let tempPath: string | undefined;

    try {
      // Determinar la ruta de destino
      const basePath = options.basePath || '/media';
      const destination = await getDestinationPath(
        options.type,
        options.seriesName || options.name,
        options.year,
        options.seasonNumber,
        options.episodeNumber,
        options.episodeTitle || options.name,
        options.container,
        { basePath }
      );

      // Crear directorio si no existe
      await ensureDirectory(destination.directory);

      // Verificar si el archivo ya existe
      if (existsSync(destination.fullPath)) {
        throw new Error(`El archivo ya existe: ${destination.fullPath}`);
      }

      tempPath = `${destination.fullPath}.download`;

      // Si quedó un temporal viejo, limpiarlo
      if (existsSync(tempPath)) {
        await unlink(tempPath).catch(() => undefined);
      }

      // Iniciar la descarga
      const response = await fetch(options.url, {
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Error al descargar: ${response.status} ${response.statusText}`);
      }

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : undefined;

      // Crear stream de escritura en fichero temporal
      const fileStream = createWriteStream(tempPath);
      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error('No se pudo obtener el reader de la respuesta');
      }

      let downloadedBytes = 0;
      const startTime = Date.now();

      // Leer y escribir en chunks
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        downloadedBytes += value.length;

        // Escribir el chunk
        fileStream.write(value);

        // Actualizar progreso
        const progress = totalBytes ? downloadedBytes / totalBytes : 0;
        const elapsed = (Date.now() - startTime) / 1000;
        const speed = elapsed > 0 ? downloadedBytes / elapsed : 0;
        const eta = speed > 0 && totalBytes ? (totalBytes - downloadedBytes) / speed : undefined;

        active.onProgress?.({
          id: options.id,
          status: 'downloading',
          progress,
          downloadedBytes,
          totalBytes,
          speed,
          eta,
        });
      }

      fileStream.end();

      // Verificar que el archivo se haya descargado correctamente
      const stats = await stat(tempPath);
      if (stats.size === 0) {
        throw new Error('El archivo descargado está vacío');
      }

      // Mover de .download a archivo final
      await rename(tempPath, destination.fullPath);

      // Notificar completitud
      active.onProgress?.({
        id: options.id,
        status: 'completed',
        progress: 1,
        downloadedBytes,
        totalBytes,
        speed: 0,
        eta: 0,
      });

      active.onComplete?.(destination.fullPath);

      return destination.fullPath;
    } catch (error) {
      if (tempPath && existsSync(tempPath)) {
        await unlink(tempPath).catch(() => undefined);
      }

      if (error instanceof Error && error.name === 'AbortError') {
        active.onProgress?.({
          id: options.id,
          status: 'cancelled',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: undefined,
          speed: 0,
          eta: undefined,
        });
      } else {
        const errorMsg = error instanceof Error ? error.message : 'Error desconocido';
        active.onProgress?.({
          id: options.id,
          status: 'error',
          progress: 0,
          downloadedBytes: 0,
          totalBytes: undefined,
          speed: 0,
          eta: undefined,
          error: errorMsg,
        });
        active.onError?.(error as Error);
      }
      throw error;
    } finally {
      this.activeDownloads.delete(options.id);
    }
  }

  /**
   * Pausa una descarga
   */
  pause(id: string): boolean {
    const download = this.activeDownloads.get(id);
    if (!download) return false;

    download.controller.abort();
    this.activeDownloads.delete(id);
    return true;
  }

  /**
   * Cancela una descarga
   */
  cancel(id: string): boolean {
    return this.pause(id);
  }

  /**
   * Verifica si una descarga está activa
   */
  isActive(id: string): boolean {
    return this.activeDownloads.has(id);
  }

  /**
   * Obtiene el número de descargas activas
   */
  getActiveCount(): number {
    return this.activeDownloads.size;
  }

  /**
   * Establece el número máximo de descargas concurrentes
   */
  setMaxConcurrent(max: number): void {
    this.maxConcurrentDownloads = Math.max(1, max);
  }

  /**
   * Obtiene el número máximo de descargas concurrentes
   */
  getMaxConcurrent(): number {
    return this.maxConcurrentDownloads;
  }

  /**
   * Cancela todas las descargas activas
   */
  cancelAll(): void {
    for (const [id, download] of this.activeDownloads) {
      download.controller.abort();
    }
    this.activeDownloads.clear();
  }
}

// Instancia singleton del gestor de descargas
export const downloadManager = new DownloadManager();
