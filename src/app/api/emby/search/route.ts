/**
 * API Route: /api/emby/search
 * Busca contenido en Emby/Jellyfin
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchItems, ensureAuthenticated } from '@/lib/emby/client';

export async function GET(request: NextRequest) {
  try {
    // Asegurar que estamos autenticados
    await ensureAuthenticated();

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Se requiere el parámetro de búsqueda q' }, { status: 400 });
    }

    const type = searchParams.get('type') as 'Movie' | 'Series' | undefined;

    const results = await searchItems(query, type);

    return NextResponse.json({
      items: results,
      total: results.length,
    });
  } catch (error) {
    console.error('Error en búsqueda de Emby:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al buscar en Emby' },
      { status: 500 }
    );
  }
}
