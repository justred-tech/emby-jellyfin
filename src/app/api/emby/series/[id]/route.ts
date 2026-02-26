/**
 * API Route: /api/emby/series/[id]
 * Obtiene información de una serie incluyendo temporadas y episodios
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSeriesInfo, getEpisodes, getSeasonEpisodes, getDownloadUrl, ensureAuthenticated } from '@/lib/emby/client';

const SERIES_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const seriesCache = new Map<string, { data: any; cachedAt: number }>();

function seriesCacheKey(id: string, season?: string | null): string {
  return `${id}::${season || 'all'}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const season = searchParams.get('season');

    const key = seriesCacheKey(id, season);
    const now = Date.now();
    const cached = seriesCache.get(key);
    if (cached && now - cached.cachedAt < SERIES_CACHE_TTL_MS) {
      return NextResponse.json(
        {
          ...cached.data,
          cached: true,
        },
        { headers: { 'X-Series-Cache': 'HIT' } }
      );
    }

    // Asegurar que estamos autenticados solo en cache miss
    await ensureAuthenticated();

    if (season) {
      // Obtener episodios de una temporada específica
      const seasonNumber = parseInt(season, 10);
      const episodes = await getSeasonEpisodes(id, seasonNumber);

      // Añadir URLs de descarga
      const episodesWithUrls = episodes.map((ep) => ({
        ...ep,
        downloadUrl: getDownloadUrl(ep.Id),
      }));

      const payload = {
        episodes: episodesWithUrls,
        total: episodesWithUrls.length,
      };

      seriesCache.set(key, { data: payload, cachedAt: now });

      return NextResponse.json(
        {
          ...payload,
          cached: false,
        },
        { headers: { 'X-Series-Cache': 'MISS' } }
      );
    } else {
      // Obtener información completa de la serie
      const seriesInfo = await getSeriesInfo(id);

      // Obtener todos los episodios
      const allEpisodes = await getEpisodes(id);

      const payload = {
        series: seriesInfo,
        episodes: allEpisodes,
      };

      seriesCache.set(key, { data: payload, cachedAt: now });

      return NextResponse.json(
        {
          ...payload,
          cached: false,
        },
        { headers: { 'X-Series-Cache': 'MISS' } }
      );
    }
  } catch (error) {
    console.error('Error al obtener información de la serie:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener información de la serie' },
      { status: 500 }
    );
  }
}
