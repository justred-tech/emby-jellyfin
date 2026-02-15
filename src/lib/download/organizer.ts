/**
 * Organizador de archivos descargados
 * Define la estructura de directorios y nombres de archivo para películas y series
 */

import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';

/**
 * Opciones de organización de archivos
 */
export interface OrganizerOptions {
  basePath: string; // Ruta base para las descargas
  moviesPath?: string; // Subdirectorio para películas (default: 'movies')
  tvShowsPath?: string; // Subdirectorio para series (default: 'tvshows')
}

/**
 * Resultado de la organización de un archivo
 */
export interface OrganizedPath {
  fullPath: string; // Ruta completa del archivo
  directory: string; // Directorio donde se guardará
  fileName: string; // Nombre del archivo
  relativePath: string; // Ruta relativa desde la base
}

const DEFAULT_OPTIONS: OrganizerOptions = {
  basePath: '/media',
  moviesPath: 'movies',
  tvShowsPath: 'tvshows',
};

/**
 * Organiza la ruta para una película
 * Formato: /media/movies/Nombre (Año)/Nombre (Año).ext
 */
export async function organizeMovie(
  name: string,
  year: number,
  container: string,
  options: OrganizerOptions = DEFAULT_OPTIONS
): Promise<OrganizedPath> {
  const moviesDir = join(options.basePath, options.moviesPath || 'movies');
  const movieDir = join(moviesDir, `${name} (${year})`);
  const fileName = `${name} (${year}).${container}`;

  return {
    fullPath: join(movieDir, fileName),
    directory: movieDir,
    fileName,
    relativePath: join(options.moviesPath || 'movies', `${name} (${year})`, fileName),
  };
}

/**
 * Organiza la ruta para un episodio
 * Formato: /media/tvshows/Serie/Season 01/Serie - S01E01 - Título.ext
 */
export async function organizeEpisode(
  seriesName: string,
  seasonNumber: number,
  episodeNumber: number,
  episodeTitle: string,
  container: string,
  options: OrganizerOptions = DEFAULT_OPTIONS
): Promise<OrganizedPath> {
  const tvShowsDir = join(options.basePath, options.tvShowsPath || 'tvshows');
  const seriesDir = join(tvShowsDir, seriesName);
  const seasonStr = seasonNumber.toString().padStart(2, '0');
  const seasonDir = join(seriesDir, `Season ${seasonStr}`);
  const episodeStr = episodeNumber.toString().padStart(2, '0');
  const fileName = `${seriesName} - S${seasonStr}E${episodeStr} - ${episodeTitle}.${container}`;

  return {
    fullPath: join(seasonDir, fileName),
    directory: seasonDir,
    fileName,
    relativePath: join(
      options.tvShowsPath || 'tvshows',
      seriesName,
      `Season ${seasonStr}`,
      fileName
    ),
  };
}

/**
 * Crea el directorio si no existe
 */
export async function ensureDirectory(directory: string): Promise<void> {
  try {
    await mkdir(directory, { recursive: true });
  } catch (error) {
    console.error(`Error al crear directorio ${directory}:`, error);
    throw error;
  }
}

/**
 * Limpia nombres de archivo para que sean válidos en el sistema de archivos
 */
export function sanitizeFileName(name: string): string {
  // Caracteres inválidos en la mayoría de sistemas de archivos
  const invalidChars = /[<>:"/\\|?*\x00-\x1f]/g;

  // Reemplazar caracteres inválidos por guion
  let sanitized = name.replace(invalidChars, '-');

  // Limitar longitud (la mayoría de sistemas tienen límite de 255 caracteres)
  if (sanitized.length > 200) {
    sanitized = sanitized.substring(0, 200);
  }

  // Eliminar puntos al inicio y al final
  sanitized = sanitized.replace(/^\.+|\.+$/g, '');

  // Eliminar espacios consecutivos
  sanitized = sanitized.replace(/\s+/g, ' ').trim();

  return sanitized || 'unnamed';
}

/**
 * Sanitiza un nombre de serie manteniendo caracteres especiales comunes
 */
export function sanitizeSeriesName(name: string): string {
  // Permitir algunos caracteres especiales como :, ', -
  const invalidChars = /[<>"/\\|?*\x00-\x1f]/g;
  let sanitized = name.replace(invalidChars, '');

  if (sanitized.length > 150) {
    sanitized = sanitized.substring(0, 150);
  }

  return sanitized.trim() || 'Unknown Series';
}

/**
 * Obtiene la ruta de destino para un item de descarga
 */
export async function getDestinationPath(
  type: 'movie' | 'episode' | 'season',
  name: string,
  year: number | undefined,
  seasonNumber: number | undefined,
  episodeNumber: number | undefined,
  episodeTitle: string | undefined,
  container: string,
  options: OrganizerOptions = DEFAULT_OPTIONS
): Promise<OrganizedPath> {
  if (type === 'movie') {
    if (!year) {
      throw new Error('Se requiere el año para organizar una película');
    }
    return organizeMovie(name, year, container, options);
  } else if (type === 'episode') {
    if (!seasonNumber || !episodeNumber || !episodeTitle) {
      throw new Error(
        'Se requiere número de temporada, episodio y título para organizar un episodio'
      );
    }
    return organizeEpisode(name, seasonNumber, episodeNumber, episodeTitle, container, options);
  } else {
    // season - crear directorio de temporada
    if (!seasonNumber) {
      throw new Error('Se requiere número de temporada para organizar una temporada');
    }
    const tvShowsDir = join(options.basePath, options.tvShowsPath || 'tvshows');
    const seriesDir = join(tvShowsDir, name);
    const seasonStr = seasonNumber.toString().padStart(2, '0');
    const seasonDir = join(seriesDir, `Season ${seasonStr}`);

    return {
      fullPath: seasonDir,
      directory: seasonDir,
      fileName: '',
      relativePath: join(options.tvShowsPath || 'tvshows', name, `Season ${seasonStr}`),
    };
  }
}

/**
 * Calcula el espacio disponible en un directorio (Linux only)
 */
export async function getAvailableSpace(directory: string): Promise<number> {
  try {
    const { exec } = require('child_process');
    return new Promise((resolve, reject) => {
      exec(`df -k "${directory}"`, (error: any, stdout: string) => {
        if (error) {
          reject(error);
          return;
        }

        const lines = stdout.split('\n');
        if (lines.length < 2) {
          reject(new Error('Salida de df inválida'));
          return;
        }

        const parts = lines[1].split(/\s+/);
        // La columna 4 es el espacio disponible en KB
        const availableKb = parseInt(parts[3], 10);
        resolve(availableKb * 1024);
      });
    });
  } catch {
    // Si no se puede obtener, devolver un valor grande para permitir descargas
    return Number.MAX_SAFE_INTEGER;
  }
}
