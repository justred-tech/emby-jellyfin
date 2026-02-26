import Database from 'better-sqlite3';
import { mkdirSync, existsSync, statSync } from 'fs';
import { join } from 'path';

/**
 * Conexión a la base de datos SQLite
 * Utiliza better-sqlite3 para operaciones síncronas
 */
let db: Database.Database | null = null;

// Schema SQL embebido
const SCHEMA = `
-- Esquema de la base de datos para el gestor de descargas de Emby a Jellyfin

-- Tabla de cola de descargas
CREATE TABLE IF NOT EXISTS download_queue (
  id TEXT PRIMARY KEY,
  emby_item_id TEXT NOT NULL,
  emby_item_name TEXT NOT NULL,
  type TEXT NOT NULL,
  series_id TEXT,
  season_number INTEGER,
  episode_number INTEGER,
  year INTEGER,
  status TEXT NOT NULL DEFAULT 'pending',
  progress REAL DEFAULT 0,
  downloaded_bytes INTEGER DEFAULT 0,
  total_bytes INTEGER,
  download_url TEXT NOT NULL,
  destination_path TEXT NOT NULL,
  error_message TEXT,
  added_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  priority INTEGER DEFAULT 0
);

-- Tabla de historial de descargas
CREATE TABLE IF NOT EXISTS download_history (
  id TEXT PRIMARY KEY,
  emby_item_id TEXT NOT NULL,
  emby_item_name TEXT NOT NULL,
  type TEXT NOT NULL,
  series_id TEXT,
  season_number INTEGER,
  episode_number INTEGER,
  year INTEGER,
  status TEXT NOT NULL,
  downloaded_bytes INTEGER DEFAULT 0,
  total_bytes INTEGER,
  destination_path TEXT,
  error_message TEXT,
  added_at INTEGER NOT NULL,
  completed_at INTEGER NOT NULL
);

-- Tabla de configuración
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Índices para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_queue_status ON download_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_added_at ON download_queue(added_at);
CREATE INDEX IF NOT EXISTS idx_history_completed_at ON download_history(completed_at);

-- Configuración por defecto
INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
  ('download_path', '/media', strftime('%s', 'now')),
  ('max_concurrent_downloads', '1', strftime('%s', 'now')),
  ('emby_host', '', strftime('%s', 'now')),
  ('emby_api_key', '', strftime('%s', 'now')),
  ('emby_user_id', '', strftime('%s', 'now'));
`;

// Tipos de registro para la base de datos
export interface DownloadQueueItem {
  id: string;
  emby_item_id: string;
  emby_item_name: string;
  type: 'movie' | 'episode' | 'season' | 'series';
  series_id?: string;
  season_number?: number;
  episode_number?: number;
  year?: number;
  status: 'pending' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  progress: number;
  downloaded_bytes: number;
  total_bytes?: number;
  download_url: string;
  destination_path: string;
  error_message?: string;
  added_at: number;
  started_at?: number;
  completed_at?: number;
  priority: number;
}

export interface DownloadHistoryItem {
  id: string;
  emby_item_id: string;
  emby_item_name: string;
  type: 'movie' | 'episode' | 'season' | 'series';
  series_id?: string;
  season_number?: number;
  episode_number?: number;
  year?: number;
  status: 'completed' | 'error' | 'cancelled';
  downloaded_bytes: number;
  total_bytes?: number;
  destination_path?: string;
  error_message?: string;
  added_at: number;
  completed_at: number;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: number;
}

/**
 * Inicializa la conexión a la base de datos
 */
export function initDatabase(): Database.Database {
  if (db) {
    return db;
  }

  // Crear directorio de datos si no existe
  const dbDir = join(process.cwd(), 'data');
  const dbPath = join(dbDir, 'downloads.db');

  try {
    // Asegurar que el directorio existe
    mkdirSync(dbDir, { recursive: true });

    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');

    // Ejecutar el esquema embebido
    db.exec(SCHEMA);

    console.log('Base de datos inicializada correctamente');
    return db;
  } catch (error) {
    console.error('Error al inicializar la base de datos:', error);
    throw error;
  }
}

/**
 * Obtiene la instancia de la base de datos
 */
export function getDatabase(): Database.Database {
  if (!db) {
    return initDatabase();
  }
  return db;
}

/**
 * Cierra la conexión a la base de datos
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}

// ============ OPERACIONES DE COLA DE DESCARGAS ============

/**
 * Añade un item a la cola de descargas
 */
export function addToQueue(item: Omit<DownloadQueueItem, 'added_at' | 'progress' | 'downloaded_bytes'>): DownloadQueueItem {
  const database = getDatabase();
  const now = Date.now();

  const newItem: DownloadQueueItem = {
    ...item,
    added_at: now,
    progress: 0,
    downloaded_bytes: 0,
  };

  const stmt = database.prepare(`
    INSERT INTO download_queue (
      id, emby_item_id, emby_item_name, type, series_id, season_number, episode_number,
      year, status, progress, downloaded_bytes, total_bytes, download_url,
      destination_path, error_message, added_at, started_at, completed_at, priority
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    newItem.id,
    newItem.emby_item_id,
    newItem.emby_item_name,
    newItem.type,
    newItem.series_id || null,
    newItem.season_number || null,
    newItem.episode_number || null,
    newItem.year || null,
    newItem.status,
    newItem.progress,
    newItem.downloaded_bytes,
    newItem.total_bytes || null,
    newItem.download_url,
    newItem.destination_path,
    newItem.error_message || null,
    newItem.added_at,
    newItem.started_at || null,
    newItem.completed_at || null,
    newItem.priority
  );

  return newItem;
}

/**
 * Obtiene todos los items de la cola
 */
export function getQueue(): DownloadQueueItem[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM download_queue
    ORDER BY priority DESC, added_at ASC
  `);
  return stmt.all() as DownloadQueueItem[];
}

/**
 * Obtiene un item de la cola por su ID
 */
export function getQueueItem(id: string): DownloadQueueItem | undefined {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM download_queue WHERE id = ?');
  return stmt.get(id) as DownloadQueueItem | undefined;
}

/**
 * Actualiza el estado de un item en la cola
 */
export function updateQueueItem(
  id: string,
  updates: Partial<Omit<DownloadQueueItem, 'id' | 'added_at'>>
): boolean {
  const database = getDatabase();

  const fields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  if (fields.length === 0) return false;

  values.push(id);
  const stmt = database.prepare(`
    UPDATE download_queue
    SET ${fields.join(', ')}
    WHERE id = ?
  `);

  const result = stmt.run(...values);
  return result.changes > 0;
}

/**
 * Actualiza el progreso de una descarga
 */
export function updateDownloadProgress(
  id: string,
  progress: number,
  downloaded_bytes: number
): boolean {
  return updateQueueItem(id, { progress, downloaded_bytes });
}

/**
 * Elimina un item de la cola
 */
export function removeFromQueue(id: string): boolean {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM download_queue WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

/**
 * Obtiene el siguiente item pendiente de la cola
 */
export function getNextPendingItem(): DownloadQueueItem | undefined {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM download_queue
    WHERE status = 'pending'
    ORDER BY priority DESC, added_at ASC
    LIMIT 1
  `);
  return stmt.get() as DownloadQueueItem | undefined;
}

/**
 * Marca un item como completado y lo mueve al historial
 */
export function completeDownload(id: string): void {
  const database = getDatabase();

  const item = getQueueItem(id);
  if (!item) return;

  // Insertar en el historial
  const historyItem: DownloadHistoryItem = {
    id: item.id,
    emby_item_id: item.emby_item_id,
    emby_item_name: item.emby_item_name,
    type: item.type,
    series_id: item.series_id,
    season_number: item.season_number,
    episode_number: item.episode_number,
    year: item.year,
    status: item.status === 'completed' ? 'completed' : 'error',
    downloaded_bytes: item.downloaded_bytes,
    total_bytes: item.total_bytes,
    destination_path: item.destination_path,
    error_message: item.error_message,
    added_at: item.added_at,
    completed_at: item.completed_at || Date.now(),
  };

  const stmt = database.prepare(`
    INSERT INTO download_history (
      id, emby_item_id, emby_item_name, type, series_id, season_number, episode_number,
      year, status, downloaded_bytes, total_bytes, destination_path, error_message,
      added_at, completed_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run(
    historyItem.id,
    historyItem.emby_item_id,
    historyItem.emby_item_name,
    historyItem.type,
    historyItem.series_id || null,
    historyItem.season_number || null,
    historyItem.episode_number || null,
    historyItem.year || null,
    historyItem.status,
    historyItem.downloaded_bytes,
    historyItem.total_bytes || null,
    historyItem.destination_path || null,
    historyItem.error_message || null,
    historyItem.added_at,
    historyItem.completed_at
  );

  // Eliminar de la cola
  removeFromQueue(id);
}

// ============ OPERACIONES DE HISTORIAL ============

/**
 * Obtiene el historial de descargas
 */
export function getHistory(limit: number = 50): DownloadHistoryItem[] {
  const database = getDatabase();
  const stmt = database.prepare(`
    SELECT * FROM download_history
    ORDER BY completed_at DESC
    LIMIT ?
  `);
  return stmt.all(limit) as DownloadHistoryItem[];
}

/**
 * Verifica si un item de Emby ya está en cola o ya se completó
 */
export function existsQueuedOrCompletedByEmbyItemId(embyItemId: string): boolean {
  const database = getDatabase();

  const inQueueStmt = database.prepare(`
    SELECT 1 FROM download_queue
    WHERE emby_item_id = ?
      AND status IN ('pending', 'downloading', 'paused', 'completed')
    LIMIT 1
  `);

  const inQueue = inQueueStmt.get(embyItemId);
  if (inQueue) return true;

  const historyStmt = database.prepare(`
    SELECT destination_path, downloaded_bytes
    FROM download_history
    WHERE emby_item_id = ?
      AND status = 'completed'
    ORDER BY completed_at DESC
    LIMIT 1
  `);

  const minValidFileBytes = parseInt(process.env.MIN_VALID_FILE_BYTES || '1048576', 10);
  const inHistory = historyStmt.get(embyItemId) as { destination_path?: string; downloaded_bytes?: number } | undefined;

  if (!inHistory) return false;

  const p = inHistory.destination_path;
  if (!p || !existsSync(p)) return false;

  try {
    const size = statSync(p).size;
    return size >= minValidFileBytes;
  } catch {
    return false;
  }
}

/**
 * Limpia el historial anterior a una fecha
 */
export function clearHistory(before: number): number {
  const database = getDatabase();
  const stmt = database.prepare('DELETE FROM download_history WHERE completed_at < ?');
  const result = stmt.run(before);
  return result.changes;
}

// ============ OPERACIONES DE CONFIGURACIÓN ============

/**
 * Obtiene una configuración
 */
export function getSetting(key: string): string | undefined {
  const database = getDatabase();
  const stmt = database.prepare('SELECT value FROM settings WHERE key = ?');
  const result = stmt.get(key) as { value: string } | undefined;
  return result?.value;
}

/**
 * Establece una configuración
 */
export function setSetting(key: string, value: string): void {
  const database = getDatabase();
  const now = Date.now();
  const stmt = database.prepare(`
    INSERT OR REPLACE INTO settings (key, value, updated_at)
    VALUES (?, ?, ?)
  `);
  stmt.run(key, value, now);
}

/**
 * Obtiene todas las configuraciones
 */
export function getAllSettings(): Record<string, string> {
  const database = getDatabase();
  const stmt = database.prepare('SELECT key, value FROM settings');
  const rows = stmt.all() as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}
