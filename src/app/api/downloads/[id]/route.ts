/**
 * API Route: /api/downloads/[id]
 * Gestiona descargas individuales
 * DELETE: Cancela una descarga
 * POST: Pausa/reanuda una descarga
 */

import { NextRequest, NextResponse } from 'next/server';
import { cancelQueuedDownload, pauseQueuedDownload } from '@/lib/download/queue';
import { getQueueItem, updateQueueItem } from '@/lib/db';
import { queueProcessor } from '@/lib/download/queue';

/**
 * DELETE - Cancela una descarga
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const success = cancelQueuedDownload(id);

    if (!success) {
      return NextResponse.json({ error: 'Descarga no encontrada' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Descarga cancelada',
    });
  } catch (error) {
    console.error('Error al cancelar descarga:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al cancelar descarga' },
      { status: 500 }
    );
  }
}

/**
 * POST - Pausa o reanuda una descarga
 * Body: { action: 'pause' | 'resume' }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'pause') {
      const success = pauseQueuedDownload(id);

      if (!success) {
        return NextResponse.json({ error: 'No se pudo pausar la descarga' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        message: 'Descarga pausada',
      });
    } else if (action === 'resume') {
      const item = getQueueItem(id);

      if (!item) {
        return NextResponse.json({ error: 'Descarga no encontrada' }, { status: 404 });
      }

      // Actualizar estado a pending
      updateQueueItem(id, { status: 'pending' });

      // Reanudar el procesador si está pausado
      if (queueProcessor.getStatus() === 'paused') {
        queueProcessor.resume();
      } else if (queueProcessor.getStatus() === 'idle') {
        queueProcessor.start();
      }

      return NextResponse.json({
        success: true,
        message: 'Descarga reanudada',
      });
    } else {
      return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error al gestionar descarga:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al gestionar descarga' },
      { status: 500 }
    );
  }
}
