-- Esquema de la base de datos para el gestor de descargas de Emby a Jellyfin

-- Tabla de cola de descargas
CREATE TABLE IF NOT EXISTS download_queue (
  id TEXT PRIMARY KEY,
  emby_item_id TEXT NOT NULL,
  emby_item_name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'movie', 'episode', 'season', 'series'
  series_id TEXT, -- Para episodios y temporadas
  season_number INTEGER, -- Para episodios y temporadas
  episode_number INTEGER, -- Para episodios
  year INTEGER, -- Para películas
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'downloading', 'paused', 'completed', 'error', 'cancelled'
  progress REAL DEFAULT 0, -- 0.0 a 1.0
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
  status TEXT NOT NULL, -- 'completed', 'error', 'cancelled'
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
