export interface EmbyItem {
  Id: string;
  Name: string;
  Type: "Movie" | "Series";
  ProductionYear?: number;
  PrimaryImageItemId?: string;
  ImageTags?: {
    Primary?: string;
  };
  Overview?: string;
  BackdropImageItemId?: string;
  ImageBackdropTags?: {
    Backdrop?: string;
  };
  SeasonId?: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  RunTimeTicks?: number;
}

export interface EmbySeason {
  Id: string;
  Name: string;
  IndexNumber?: number;
  SeriesId: string;
}

export interface EmbyEpisode {
  Id: string;
  Name: string;
  IndexNumber?: number;
  ParentIndexNumber?: number;
  Overview?: string;
  RunTimeTicks?: number;
}

export interface DownloadRequest {
  itemId: string;
  itemTitle: string;
  itemType: "movie" | "series";
  seasonNumber?: number;
  episodeNumber?: number;
}
