/**
 * API Route: /api/downloads
 * Gestiona la cola de descargas
 * GET: Obtiene la cola actual
 * POST: Añade items a la cola
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  getDownloadQueue,
  addMovieToQueue,
  addEpisodeToQueue,
  addSeasonToQueue,
} from '@/lib/download/queue';
import { getDownloadUrl, ensureAuthenticated, getEmbyConfig } from '@/lib/emby/client';

/**
 * GET - Obtiene la cola de descargas actual
 */
export async function GET() {
  try {
    const queue = getDownloadQueue();

    return NextResponse.json({
      queue,
      total: queue.length,
    });
  } catch (error) {
    console.error('Error al obtener cola de descargas:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener cola' },
      { status: 500 }
    );
  }
}

/**
 * POST - Añade items a la cola de descargas
 * Body: {
 *   type: 'movie' | 'episode' | 'season',
 *   itemId: string,
 *   name: string,
 *   year?: number,
 *   seriesId?: string,
 *   seriesName?: string,
 *   seasonNumber?: number,
 *   episodeNumber?: number,
 *   episodeIds?: string[]
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Asegurar que estamos autenticados
    await ensureAuthenticated();

    const body = await request.json();
    const {
      type,
      itemId,
      name,
      year,
      seriesId,
      seriesName,
      seasonNumber,
      episodeNumber,
      episodeIds,
    } = body;

    if (!type || !itemId) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos: type, itemId' },
        { status: 400 }
      );
    }

    const config = getEmbyConfig();

    let downloadId: string | string[] = '';

    switch (type) {
      case 'movie':
        if (!year) {
          return NextResponse.json(
            { error: 'Se requiere el año para películas' },
            { status: 400 }
          );
        }

        const movieUrl = getDownloadUrl(itemId, config);
        downloadId = await addMovieToQueue(itemId, name, year, movieUrl);
        break;

      case 'episode':
        if (!seriesId || !seasonNumber || !episodeNumber) {
          return NextResponse.json(
            { error: 'Faltan parámetros para episodio: seriesId, seasonNumber, episodeNumber' },
            { status: 400 }
          );
        }

        const episodeUrl = getDownloadUrl(itemId, config);
        downloadId = await addEpisodeToQueue(
          itemId,
          name,
          seriesId,
          seriesName || '',
          seasonNumber,
          episodeNumber,
          episodeUrl
        );
        break;

      case 'season':
        if (!seriesId || !seriesName || !seasonNumber || !episodeIds) {
          return NextResponse.json(
            { error: 'Faltan parámetros para temporada: seriesId, seriesName, seasonNumber, episodeIds' },
            { status: 400 }
          );
        }

        downloadId = await addSeasonToQueue(seriesId, seriesName, seasonNumber, episodeIds);
        break;

      default:
        return NextResponse.json({ error: 'Tipo de descarga no válido' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      id: downloadId,
      message: 'Descarga añadida a la cola',
    });
  } catch (error) {
    console.error('Error al añadir descarga:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al añadir descarga' },
      { status: 500 }
    );
  }
}
