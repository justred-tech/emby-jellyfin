/**
 * Tipos para la API de Emby
 */

export type MediaType = 'Movie' | 'Series' | 'Episode' | 'Season';

export interface MediaItem {
  Id: string;
  Name: string;
  Type: MediaType;
  ProductionYear?: number;
  RunTimeTicks?: number;
  Size?: number;
  Overview?: string;
  Container?: string;
  Genres?: string[];
  OfficialRating?: string;
  ProviderIds?: {
    IMDb?: string;
    Tvdb?: string;
    Tmdb?: string;
  };
  ImageTags?: {
    Primary?: string;
    Backdrop?: string;
  };
  SeriesId?: string;
  SeriesName?: string;
  ParentIndexNumber?: number; // Temporada
  IndexNumber?: number; // Episodio
  IndexNumberEnd?: number;
}

export interface SearchResponse {
  TotalRecordCount: number;
  Items: MediaItem[];
}

export interface Episode {
  Id: string;
  Name: string;
  SeriesId: string;
  SeriesName: string;
  ParentIndexNumber: number; // Número de temporada
  IndexNumber: number; // Número de episodio
  IndexNumberEnd?: number;
  Type: 'Episode';
  RunTimeTicks?: number;
  Size?: number;
  Overview?: string;
  Container?: string;
  PremiereDate?: string;
  ProductionYear?: number;
}

export interface EpisodesResponse {
  TotalRecordCount: number;
  Items: Episode[];
}

export interface SeasonInfo {
  Id: string;
  Name: string;
  IndexNumber: number;
  SeriesId: string;
}

export interface SeriesInfo {
  Id: string;
  Name: string;
  ProductionYear?: number;
  Overview?: string;
  Seasons: SeasonInfo[];
}

export interface DownloadOptions {
  itemId: string;
  name: string;
  type: 'movie' | 'episode' | 'season';
  seriesId?: string;
  seasonNumber?: number;
  episodeNumber?: number;
  year?: number;
}

/**
 * Respuesta de búsqueda con información adicional
 */
export interface SearchResult extends MediaItem {
  downloadUrl?: string;
  destinationPath?: string;
}

/**
 * Información de un archivo multimedia
 */
export interface MediaSource {
  Protocol: string;
  Id: string;
  Path: string;
  Type: string;
  Container: string;
  Size: number;
  Name: string;
  IsRemote: boolean;
  RunTimeTicks?: number;
  SupportsTranscoding: boolean;
  SupportsDirectStream: boolean;
  SupportsDirectPlay: boolean;
  Bitrate?: number;
}
