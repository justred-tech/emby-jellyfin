/**
 * API Route: /api/downloads/events
 * Endpoint SSE para eventos en tiempo real de descargas
 */

import { NextRequest } from 'next/server';
import { createSSEStream } from '@/lib/progress/emitter';

export async function GET(request: NextRequest) {
  const stream = createSSEStream(['download', 'queue', 'system']);

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
