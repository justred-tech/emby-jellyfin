/**
 * API Route: /api/emby/search
 * Busca contenido en Emby/Jellyfin
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchItems, ensureAuthenticated } from '@/lib/emby/client';

const SEARCH_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h

type CachedSearch = {
  items: Awaited<ReturnType<typeof searchItems>>;
  total: number;
  cachedAt: number;
};

// Cache en memoria del proceso
const searchCache = new Map<string, CachedSearch>();

function getCacheKey(query: string, type?: 'Movie' | 'Series'): string {
  return `${query.trim().toLowerCase()}::${type || 'all'}`;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');

    if (!query) {
      return NextResponse.json({ error: 'Se requiere el parámetro de búsqueda q' }, { status: 400 });
    }

    const type = searchParams.get('type') as 'Movie' | 'Series' | undefined;
    const cacheKey = getCacheKey(query, type);
    const now = Date.now();

    const cached = searchCache.get(cacheKey);
    if (cached && now - cached.cachedAt < SEARCH_CACHE_TTL_MS) {
      return NextResponse.json(
        {
          items: cached.items,
          total: cached.total,
          cached: true,
        },
        {
          headers: {
            'X-Search-Cache': 'HIT',
          },
        }
      );
    }

    // Solo autenticar cuando haya miss de caché
    await ensureAuthenticated();

    const results = await searchItems(query, type);

    searchCache.set(cacheKey, {
      items: results,
      total: results.length,
      cachedAt: now,
    });

    return NextResponse.json(
      {
        items: results,
        total: results.length,
        cached: false,
      },
      {
        headers: {
          'X-Search-Cache': 'MISS',
        },
      }
    );
  } catch (error) {
    console.error('Error en búsqueda de Emby:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al buscar en Emby' },
      { status: 500 }
    );
  }
}
