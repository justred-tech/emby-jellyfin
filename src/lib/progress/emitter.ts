/**
 * Emisor de eventos de progreso para Server-Sent Events (SSE)
 * Permite comunicación en tiempo real con el frontend
 */

/**
 * Tipos de eventos que se pueden emitir
 */
export type ProgressEventType = 'download' | 'queue' | 'system';

/**
 * Evento de progreso de descarga
 */
export interface DownloadProgressEvent {
  id: string;
  progress?: number;
  downloadedBytes?: number;
  totalBytes?: number;
  speed?: number;
  eta?: number;
  status?: string;
  error?: string;
}

/**
 * Evento de cola
 */
export interface QueueEvent {
  type: 'added' | 'removed' | 'status';
  id?: string;
  item?: any;
  status?: string;
}

/**
 * Evento del sistema
 */
export interface SystemEvent {
  type: 'status' | 'error';
  message: string;
  data?: any;
}

/**
 * Evento de progreso
 */
export interface ProgressEvent {
  type: ProgressEventType;
  data: DownloadProgressEvent | QueueEvent | SystemEvent;
  timestamp: number;
}

/**
 * Cliente conectado al stream SSE
 */
interface SSEClient {
  id: string;
  controller: ReadableStreamDefaultController;
  filters?: Set<ProgressEventType>;
}

/**
 * Emisor de eventos de progreso
 */
class ProgressEmitter {
  private clients: Map<string, SSEClient> = new Map();
  private clientIdCounter = 0;

  /**
   * Registra un nuevo cliente SSE
   */
  registerClient(
    controller: ReadableStreamDefaultController,
    filters?: ProgressEventType[]
  ): string {
    const clientId = `client_${++this.clientIdCounter}`;

    const client: SSEClient = {
      id: clientId,
      controller,
      filters: filters ? new Set(filters) : undefined,
    };

    this.clients.set(clientId, client);

    // Enviar evento de conexión
    this.sendToClient(client, {
      type: 'system',
      data: {
        type: 'status',
        message: 'Conectado',
        data: { clientId },
      },
      timestamp: Date.now(),
    });

    console.log(`Cliente SSE registrado: ${clientId}`);
    return clientId;
  }

  /**
   * Desregistra un cliente SSE
   */
  unregisterClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        client.controller.close();
      } catch {
        // El cliente ya puede estar cerrado
      }
      this.clients.delete(clientId);
      console.log(`Cliente SSE desregistrado: ${clientId}`);
    }
  }

  /**
   * Envía un evento a un cliente específico
   */
  private sendToClient(client: SSEClient, event: ProgressEvent): void {
    // Verificar filtros
    if (client.filters && !client.filters.has(event.type)) {
      return;
    }

    try {
      const data = `data: ${JSON.stringify(event)}\n\n`;
      client.controller.enqueue(new TextEncoder().encode(data));
    } catch (error) {
      console.error(`Error al enviar evento al cliente ${client.id}:`, error);
      // Si hay error, desregistrar el cliente
      this.unregisterClient(client.id);
    }
  }

  /**
   * Emite un evento a todos los clientes
   */
  emit(type: ProgressEventType, data: any): void {
    const event: ProgressEvent = {
      type,
      data,
      timestamp: Date.now(),
    };

    // Enviar a todos los clientes
    for (const [clientId, client] of this.clients) {
      this.sendToClient(client, event);
    }
  }

  /**
   * Emite un evento de progreso de descarga
   */
  emitDownloadProgress(data: DownloadProgressEvent): void {
    this.emit('download', data);
  }

  /**
   * Emite un evento de cola
   */
  emitQueueEvent(data: QueueEvent): void {
    this.emit('queue', data);
  }

  /**
   * Emite un evento del sistema
   */
  emitSystemEvent(data: SystemEvent): void {
    this.emit('system', data);
  }

  /**
   * Obtiene el número de clientes conectados
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Desregistra todos los clientes
   */
  disconnectAll(): void {
    for (const clientId of this.clients.keys()) {
      this.unregisterClient(clientId);
    }
  }
}

// Instancia singleton del emisor de progreso
export const progressEmitter = new ProgressEmitter();

/**
 * Crea un stream SSE para un cliente
 */
export function createSSEStream(filters?: ProgressEventType[]): ReadableStream {
  return new ReadableStream({
    start(controller) {
      // Registrar el cliente
      const clientId = progressEmitter.registerClient(controller, filters);

      // Enviar keep-alive cada 30 segundos
      const keepAliveInterval = setInterval(() => {
        try {
          controller.enqueue(new TextEncoder().encode(': keep-alive\n\n'));
        } catch {
          clearInterval(keepAliveInterval);
        }
      }, 30000);

      // Limpiar al cerrar el stream
      return () => {
        clearInterval(keepAliveInterval);
        progressEmitter.unregisterClient(clientId);
      };
    },
    cancel() {
      // El cliente se desconectó
    },
  });
}

/**
 * Shorthand para emitir eventos
 */
export const emit = progressEmitter.emit.bind(progressEmitter);
