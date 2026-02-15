/**
 * API Route: /api/history
 * Obtiene el historial de descargas
 */

import { NextRequest, NextResponse } from 'next/server';
import { getHistory, clearHistory } from '@/lib/db';

/**
 * GET - Obtiene el historial de descargas
 * Query params: limit (default: 50)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const history = getHistory(limit);

    return NextResponse.json({
      history,
      total: history.length,
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al obtener historial' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Limpia el historial anterior a una fecha
 * Query params: before (timestamp)
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const before = parseInt(searchParams.get('before') || `${Date.now()}`, 10);

    const deleted = clearHistory(before);

    return NextResponse.json({
      success: true,
      deleted,
    });
  } catch (error) {
    console.error('Error al limpiar historial:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Error al limpiar historial' },
      { status: 500 }
    );
  }
}
