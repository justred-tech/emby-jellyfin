/**
 * API Route: /api/emby/series/[id]
 * Obtiene información de una serie incluyendo temporadas y episodios
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSeriesInfo, getEpisodes, getSeasonEpisodes, getDownloadUrl, ensureAuthenticated } from '@/lib/emby/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Asegurar que estamos autenticados
    await ensureAuthenticated();

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const season = searchParams.get('season');

    if (season) {
      // Obtener episodios de una temporada específica
      const seasonNumber = parseInt(season, 10);
      const episodes = await getSeasonEpisodes(id, seasonNumber);

      // Añadir URLs de descarga
      const episodesWithUrls = episodes.map((ep) => ({
        ...ep,
        downloadUrl: getDownloadUrl(ep.Id),
      }));

      return NextResponse.json({
        episodes: episodesWithUrls,
        total: episodesWithUrls.length,
      });
    } else {
      // Obtener información completa de la serie
      const seriesInfo = await getSeriesInfo(id);

      // Obtener todos los episodios
      const allEpisodes = await getEpisodes(id);

      return NextResponse.json({
        series: seriesInfo,
        episodes: allEpisodes,
      });
    }
  } catch (error) {
    console.error('Error al obtener información de la serie:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener información de la serie' },
      { status: 500 }
    );
  }
}
