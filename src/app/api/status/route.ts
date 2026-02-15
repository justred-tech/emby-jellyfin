/**
 * API Route: /api/status
 * Obtiene el estado del sistema
 */

import { NextResponse } from 'next/server';
import { testConnection } from '@/lib/emby/client';
import { getAllSettings } from '@/lib/db';
import { queueProcessor } from '@/lib/download/queue';
import { downloadManager } from '@/lib/download/downloader';
import { progressEmitter } from '@/lib/progress/emitter';

export async function GET() {
  try {
    // Verificar conexión con Emby
    const embyConnected = await testConnection();

    // Obtener configuración
    const settings = getAllSettings();

    // Estado de la cola
    const queueStatus = queueProcessor.getStatus();
    const processingId = queueProcessor.getProcessingId();

    return NextResponse.json({
      emby: {
        connected: embyConnected,
        host: settings.emby_host || '',
      },
      queue: {
        status: queueStatus,
        processingId,
        maxConcurrent: downloadManager.getMaxConcurrent(),
        activeDownloads: downloadManager.getActiveCount(),
      },
      system: {
        connectedClients: progressEmitter.getClientCount(),
        uptime: process.uptime(),
      },
    });
  } catch (error) {
    console.error('Error al obtener estado:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener estado' },
      { status: 500 }
    );
  }
}
