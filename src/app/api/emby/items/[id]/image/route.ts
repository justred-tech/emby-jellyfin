/**
 * API Route: /api/emby/items/[id]/image
 * Proxy para obtener imágenes de Emby/Jellyfin
 */

import { NextRequest, NextResponse } from 'next/server';
import { getImageUrl, ensureAuthenticated } from '@/lib/emby/client';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Asegurar que estamos autenticados
    await ensureAuthenticated();

    const { id } = await params;
    const searchParams = request.nextUrl.searchParams;
    const imageType = (searchParams.get('type') || 'Primary') as 'Primary' | 'Backdrop' | 'Banner' | 'Thumb';
    const maxWidth = parseInt(searchParams.get('maxWidth') || '300', 10);

    const imageUrl = getImageUrl(id, imageType, maxWidth);

    // Fetch the image from Emby
    const response = await fetch(imageUrl);

    if (!response.ok) {
      return new NextResponse('Image not found', { status: 404 });
    }

    const imageBuffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || 'image/jpeg';

    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // Cache for 24 hours
      },
    });
  } catch (error) {
    console.error('Error al obtener imagen de Emby:', error);
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
