/**
 * Cliente para la API de Emby/Jellyfin
 * Permite buscar contenido, obtener detalles y descargar archivos
 */

import type {
  MediaItem,
  SearchResponse,
  Episode,
  EpisodesResponse,
  SeriesInfo,
  SeasonInfo,
} from './types';
import { getSetting, setSetting } from '../db';

// Configuración desde variables de entorno
const EMBY_HOST = process.env.EMBY_HOST || '';
const EMBY_EMAIL = process.env.EMBY_EMAIL || '';
const EMBY_PASSWORD = process.env.EMBY_PASSWORD || '';

// Cache de la sesión autenticada
let cachedConfig: { host: string; apiKey: string; userId: string } | null = null;

/**
 * Autentica con Emby usando email y contraseña
 */
async function authenticateWithEmby(
  host: string,
  email: string,
  password: string
): Promise<{ accessToken: string; userId: string }> {
  const baseUrl = host.replace(/\/$/, '').replace(/:\d+/, '') || host;
  const port = host.match(/:(\d+)/)?.[1] || '8096';
  const url = `${baseUrl}:${port}/emby/Users/AuthenticateByName`;

  // Device ID único para esta instalación
  const deviceId = 'emby-downloader-' + Buffer.from(host).toString('base64').slice(0, 16);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Emby-Authorization': `MediaBrowser Client="EmbyDownloader", Device="Web", DeviceId="${deviceId}", Version="1.0"`,
    },
    body: JSON.stringify({
      Username: email,
      Pw: password,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Error de autenticación: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  return {
    accessToken: data.AccessToken,
    userId: data.User?.Id || data.ServerId,
  };
}

/**
 * Inicializa la configuración de Emby autenticando si es necesario
 */
async function initializeEmbyConfig(): Promise<{ host: string; apiKey: string; userId: string }> {
  // Si ya tenemos config en cache, usarla
  if (cachedConfig) {
    return cachedConfig;
  }

  // Intentar obtener de la base de datos primero
  const savedHost = getSetting('emby_host');
  const savedApiKey = getSetting('emby_api_key');
  const savedUserId = getSetting('emby_user_id');

  if (savedHost && savedApiKey && savedUserId) {
    cachedConfig = { host: savedHost, apiKey: savedApiKey, userId: savedUserId };
    return cachedConfig;
  }

  // Si no hay credenciales guardadas, autenticar con email/password
  const host = EMBY_HOST || savedHost;
  const email = EMBY_EMAIL;
  const password = EMBY_PASSWORD;

  if (!host || !email || !password) {
    throw new Error('Configuración de Emby incompleta. Se requiere EMBY_HOST, EMBY_EMAIL y EMBY_PASSWORD');
  }

  try {
    const { accessToken, userId } = await authenticateWithEmby(host, email, password);

    // Guardar en base de datos para futuras sesiones
    setSetting('emby_host', host);
    setSetting('emby_api_key', accessToken);
    setSetting('emby_user_id', userId);

    cachedConfig = { host, apiKey: accessToken, userId };
    return cachedConfig;
  } catch (error) {
    console.error('Error autenticando con Emby:', error);
    throw error;
  }
}

/**
 * Obtiene la configuración de Emby (síncrono, usa cache)
 */
export function getEmbyConfig(): { host: string; apiKey: string; userId: string } {
  if (cachedConfig) {
    return cachedConfig;
  }

  // Intentar obtener de variables de entorno o base de datos
  const host = EMBY_HOST || getSetting('emby_host') || '';
  const apiKey = getSetting('emby_api_key') || '';
  const userId = getSetting('emby_user_id') || '';

  if (host && apiKey && userId) {
    cachedConfig = { host, apiKey, userId };
    return cachedConfig;
  }

  // Retornar config vacía - se necesitará autenticación asíncrona
  return { host, apiKey, userId };
}

/**
 * Asegura que la configuración está inicializada (llamar antes de operaciones)
 */
export async function ensureAuthenticated(): Promise<void> {
  await initializeEmbyConfig();
}

/**
 * Construye la URL base para las peticiones a Emby
 */
function buildBaseUrl(host: string): string {
  // Eliminar barra final si existe
  const cleanHost = host.replace(/\/$/, '');
  return `${cleanHost}/emby`;
}

/**
 * Realiza una petición a la API de Emby
 */
async function embyFetch<T>(
  endpoint: string,
  config: { host: string; apiKey: string; userId: string }
): Promise<T> {
  const baseUrl = buildBaseUrl(config.host);
  const url = `${baseUrl}${endpoint}`;

  const response = await fetch(url, {
    headers: {
      'X-Emby-Token': config.apiKey,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Error en petición a Emby: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Busca contenido en Emby
 */
export async function searchItems(
  query: string,
  itemType?: 'Movie' | 'Series' | 'Episode'
): Promise<MediaItem[]> {
  const config = getEmbyConfig();

  if (!config.host || !config.apiKey || !config.userId) {
    throw new Error('Configuración de Emby no establecida');
  }

  const params = new URLSearchParams({
    Recursive: 'true',
    SearchTerm: query,
    UserId: config.userId,
    Fields: 'MediaSources,Overview,Genres,ProviderIds,Size',
    Limit: '50',
    IncludeItemTypes: itemType || 'Movie,Series',
  });

  const endpoint = `/Users/${config.userId}/Items?${params.toString()}`;
  const data = await embyFetch<SearchResponse>(endpoint, config);

  return data.Items;
}

/**
 * Obtiene detalles de un item específico
 */
export async function getItem(itemId: string): Promise<MediaItem> {
  const config = getEmbyConfig();

  if (!config.host || !config.apiKey || !config.userId) {
    throw new Error('Configuración de Emby no establecida');
  }

  const params = new URLSearchParams({
    Fields: 'MediaSources,Overview,Genres,ProviderIds',
  });

  const endpoint = `/Users/${config.userId}/Items/${itemId}?${params.toString()}`;
  return embyFetch<MediaItem>(endpoint, config);
}

/**
 * Obtiene todos los episodios de una serie
 */
export async function getEpisodes(seriesId: string): Promise<Episode[]> {
  const config = getEmbyConfig();

  if (!config.host || !config.apiKey || !config.userId) {
    throw new Error('Configuración de Emby no establecida');
  }

  const params = new URLSearchParams({
    UserId: config.userId,
    Fields: 'MediaSources,Overview',
  });

  const endpoint = `/Shows/${seriesId}/Episodes?${params.toString()}`;
  const data = await embyFetch<EpisodesResponse>(endpoint, config);

  return data.Items;
}

/**
 * Obtiene información de una serie incluyendo temporadas
 */
export async function getSeriesInfo(seriesId: string): Promise<SeriesInfo> {
  const config = getEmbyConfig();

  if (!config.host || !config.apiKey) {
    throw new Error('Configuración de Emby no establecida');
  }

  // Obtener detalles de la serie
  const series = await getItem(seriesId);

  // Obtener temporadas
  const seasonsParams = new URLSearchParams({
    UserId: config.userId,
  });

  const seasonsEndpoint = `/Shows/${seriesId}/Seasons?${seasonsParams.toString()}`;
  const seasonsData = await embyFetch<{ Items: SeasonInfo[] }>(seasonsEndpoint, config);

  return {
    Id: series.Id,
    Name: series.Name,
    ProductionYear: series.ProductionYear,
    Overview: series.Overview,
    Seasons: seasonsData.Items,
  };
}

/**
 * Obtiene los episodios de una temporada específica
 */
export async function getSeasonEpisodes(
  seriesId: string,
  seasonNumber: number
): Promise<Episode[]> {
  const config = getEmbyConfig();

  if (!config.host || !config.apiKey || !config.userId) {
    throw new Error('Configuración de Emby no establecida');
  }

  const params = new URLSearchParams({
    UserId: config.userId,
    Season: seasonNumber.toString(),
    Fields: 'MediaSources,Overview',
  });

  const endpoint = `/Shows/${seriesId}/Episodes?${params.toString()}`;
  const data = await embyFetch<EpisodesResponse>(endpoint, config);

  return data.Items;
}

/**
 * Construye la URL de descarga para un item
 */
export function getDownloadUrl(itemId: string, config?: { host: string; apiKey: string }): string {
  const embyConfig = config || getEmbyConfig();

  if (!embyConfig.host || !embyConfig.apiKey) {
    throw new Error('Configuración de Emby no establecida');
  }

  const baseUrl = buildBaseUrl(embyConfig.host);
  return `${baseUrl}/Videos/${itemId}/stream?static=true&api_key=${embyConfig.apiKey}`;
}

/**
 * Obtiene la URL de una imagen
 */
export function getImageUrl(
  itemId: string,
  imageType: 'Primary' | 'Backdrop' | 'Banner' | 'Thumb' = 'Primary',
  maxWidth: number = 300,
  config?: { host: string; apiKey: string }
): string {
  const embyConfig = config || getEmbyConfig();

  if (!embyConfig.host) {
    throw new Error('Configuración de Emby no establecida');
  }

  const baseUrl = buildBaseUrl(embyConfig.host);
  return `${baseUrl}/Items/${itemId}/Images/${imageType}?maxWidth=${maxWidth}`;
}

/**
 * Verifica la conexión con Emby
 */
export async function testConnection(): Promise<boolean> {
  try {
    const config = getEmbyConfig();

    if (!config.host || !config.apiKey || !config.userId) {
      return false;
    }

    const baseUrl = buildBaseUrl(config.host);
    const url = `${baseUrl}/Users/${config.userId}`;

    const response = await fetch(url, {
      headers: {
        'X-Emby-Token': config.apiKey,
      },
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Obtiene el tamaño total de un item antes de descargarlo
 */
export async function getItemSize(itemId: string): Promise<number | undefined> {
  try {
    const item = await getItem(itemId);
    return item.Size;
  } catch {
    return undefined;
  }
}

/**
 * Formatea bytes a formato legible
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

/**
 * Formatea ticks de runtime a minutos/horas
 */
export function formatDuration(ticks: number): string {
  const minutes = Math.floor(ticks / 600000000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours > 0) {
    return `${hours}h ${remainingMinutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Agrupa episodios por temporada
 */
export function groupEpisodesBySeason(episodes: Episode[]): Map<number, Episode[]> {
  const seasonMap = new Map<number, Episode[]>();

  for (const episode of episodes) {
    const seasonNum = episode.ParentIndexNumber;
    if (!seasonMap.has(seasonNum)) {
      seasonMap.set(seasonNum, []);
    }
    seasonMap.get(seasonNum)!.push(episode);
  }

  // Ordenar episodios dentro de cada temporada
  for (const [seasonNum, eps] of seasonMap) {
    seasonMap.set(
      seasonNum,
      eps.sort((a, b) => (a.IndexNumber || 0) - (b.IndexNumber || 0))
    );
  }

  return seasonMap;
}

/**
 * Genera el nombre de archivo para una película
 */
export function getMovieFileName(name: string, year: number, container: string): string {
  return `${name} (${year}).${container}`;
}

/**
 * Genera el nombre de archivo para un episodio
 */
export function getEpisodeFileName(
  seriesName: string,
  seasonNumber: number,
  episodeNumber: number,
  episodeTitle: string,
  container: string
): string {
  const seasonStr = seasonNumber.toString().padStart(2, '0');
  const episodeStr = episodeNumber.toString().padStart(2, '0');
  return `${seriesName} - S${seasonStr}E${episodeStr} - ${episodeTitle}.${container}`;
}
