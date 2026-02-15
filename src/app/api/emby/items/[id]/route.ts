/**
 * API Route: /api/emby/items/[id]
 * Obtiene detalles de un item específico de Emby/Jellyfin
 */

import { NextRequest, NextResponse } from 'next/server';
import { getItem, getDownloadUrl, ensureAuthenticated } from '@/lib/emby/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Asegurar que estamos autenticados
    await ensureAuthenticated();

    const { id } = await params;

    const item = await getItem(id);

    // Generar URL de descarga
    const downloadUrl = getDownloadUrl(id);

    return NextResponse.json({
      item,
      downloadUrl,
    });
  } catch (error) {
    console.error('Error al obtener item de Emby:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener item' },
      { status: 500 }
    );
  }
}
