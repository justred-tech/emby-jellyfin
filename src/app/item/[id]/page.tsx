"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Download, Tv, Clock, HardDrive, Film, Volume2, Subtitles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

type ItemType = "movie" | "series";

interface MediaStream {
  Type?: 'Video' | 'Audio' | 'Subtitle';
  type?: 'Video' | 'Audio' | 'Subtitle';
  Codec?: string;
  codec?: string;
  Language?: string;
  language?: string;
  DisplayTitle?: string;
  displayTitle?: string;
  Title?: string;
  title?: string;
  IsDefault?: boolean;
  isDefault?: boolean;
  Channels?: number;
  channels?: number;
  Width?: number;
  Height?: number;
  width?: number;
  height?: number;
}

interface ItemDetails {
  id: string;
  title: string;
  year?: number;
  type: ItemType;
  overview?: string;
  posterUrl?: string;
  backdropUrl?: string;
  seasons?: Season[];
  // Technical data
  size?: number;
  runtime?: number;
  container?: string;
  genres?: string[];
  officialRating?: string;
  videoCodec?: string;
  audioCodec?: string;
  resolution?: string;
  // Audio and subtitle tracks
  audioTracks?: MediaStream[];
  subtitleTracks?: MediaStream[];
}

interface Season {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  episodes?: Episode[];
}

interface Episode {
  id: string;
  episodeNumber: number;
  name: string;
  overview?: string;
  runtime?: number;
  seasonNumber: number;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatRuntime(ticks: number): string {
  const minutes = Math.floor(ticks / 600000000);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours > 0) {
    return `${hours}h ${remainingMinutes}min`;
  }
  return `${minutes} min`;
}

export default function ItemDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [item, setItem] = useState<ItemDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [hasBackdrop, setHasBackdrop] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItem = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/emby/items/${id}`);
        if (!response.ok) throw new Error("Failed to fetch item");
        const data = await response.json();

        const mediaSource = data.item.MediaSources?.[0] || {};
        const mediaStreams = mediaSource.MediaStreams || [];

        const streamVideo = mediaStreams.find((s: MediaStream) => s.Type === 'Video' || s.type === 'Video') || {};
        const streamAudio = mediaStreams.find((s: MediaStream) => s.Type === 'Audio' || s.type === 'Audio') || {};

        const audioTracks = mediaStreams
          .filter((s: MediaStream) => s.Type === 'Audio' || s.type === 'Audio')
          .map((s: MediaStream) => ({
            type: s.Type || s.type,
            codec: s.Codec || s.codec,
            language: s.Language || s.language || s.DisplayTitle || s.displayTitle || s.Title || s.title || 'Desconocido',
            isDefault: s.IsDefault || s.isDefault,
            channels: s.Channels || s.channels,
          }));

        const subtitleTracks = mediaStreams
          .filter((s: MediaStream) => s.Type === 'Subtitle' || s.type === 'Subtitle')
          .map((s: MediaStream) => ({
            type: s.Type || s.type,
            language: s.Language || s.language || s.DisplayTitle || s.displayTitle || s.Title || s.title || 'Desconocido',
            isDefault: s.IsDefault || s.isDefault,
          }));

        const mappedItem: ItemDetails = {
          id: data.item.Id,
          title: data.item.Name,
          year: data.item.ProductionYear,
          type: data.item.Type?.toLowerCase() === 'movie' ? 'movie' : 'series',
          overview: data.item.Overview,
          posterUrl: `/api/emby/items/${data.item.Id}/image`,
          backdropUrl: `/api/emby/items/${data.item.Id}/image?type=Backdrop&maxWidth=1280`,
          size: data.item.Size || mediaSource.Size,
          runtime: data.item.RunTimeTicks,
          container: mediaSource.Container,
          genres: data.item.Genres,
          officialRating: data.item.OfficialRating,
          videoCodec: streamVideo.codec || streamVideo.Codec,
          audioCodec: streamAudio.codec || streamAudio.Codec,
          resolution: (streamVideo.Width || streamVideo.width) && (streamVideo.Height || streamVideo.height)
            ? `${streamVideo.Width || streamVideo.width}x${streamVideo.Height || streamVideo.height}`
            : undefined,
          audioTracks,
          subtitleTracks,
        };

        if (mappedItem.type === "series") {
          const seriesRes = await fetch(`/api/emby/series/${id}`);
          if (seriesRes.ok) {
            const seriesData = await seriesRes.json();
            const episodes = Array.isArray(seriesData.episodes) ? seriesData.episodes : [];
            const seasonMeta = Array.isArray(seriesData.series?.Seasons) ? seriesData.series.Seasons : [];

            const seasonMap = new Map<number, Episode[]>();
            for (const ep of episodes) {
              const sn = ep.ParentIndexNumber ?? 0;
              const list = seasonMap.get(sn) || [];
              list.push({
                id: ep.Id,
                episodeNumber: ep.IndexNumber ?? 0,
                name: ep.Name,
                overview: ep.Overview,
                runtime: ep.RunTimeTicks,
                seasonNumber: sn,
              });
              seasonMap.set(sn, list);
            }

            mappedItem.seasons = seasonMeta
              .map((s: { IndexNumber: number; Name: string }): Season => ({
                seasonNumber: s.IndexNumber,
                name: s.Name,
                episodes: (seasonMap.get(s.IndexNumber) || []).sort((a: Episode, b: Episode) => a.episodeNumber - b.episodeNumber),
                episodeCount: (seasonMap.get(s.IndexNumber) || []).length,
              }))
              .sort((a: Season, b: Season) => a.seasonNumber - b.seasonNumber);
          }
        }

        setItem(mappedItem);
        setHasBackdrop(!!data.item.ImageTags?.Backdrop);
      } catch (error) {
        console.error("Error fetching item:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (id) {
      fetchItem();
    }
  }, [id]);

  useEffect(() => {
    if (item?.type === "series" && item.seasons && item.seasons.length > 0 && selectedSeason === null) {
      setSelectedSeason(item.seasons[0].seasonNumber);
    }
  }, [item, selectedSeason]);

  const selectedSeasonData = useMemo(
    () => item?.seasons?.find((s) => s.seasonNumber === selectedSeason),
    [item, selectedSeason]
  );

  const handleDownloadMovie = async () => {
    if (!item || item.type !== "movie") return;
    setIsDownloading(true);
    setActionError(null);
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "movie",
          itemId: item.id,
          name: item.title,
          year: item.year,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to start download");
      router.push("/queue");
    } catch (error) {
      console.error("Error starting download:", error);
      setActionError(error instanceof Error ? error.message : "No se pudo iniciar la descarga");
      setIsDownloading(false);
    }
  };

  const handleDownloadSeries = async () => {
    if (!item || item.type !== "series") return;
    setIsDownloading(true);
    setActionError(null);
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "series",
          itemId: item.id,
          seriesId: item.id,
          seriesName: item.title,
          name: item.title,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to start download");
      router.push("/queue");
    } catch (error) {
      console.error("Error starting series download:", error);
      setActionError(error instanceof Error ? error.message : "No se pudo iniciar la descarga");
      setIsDownloading(false);
    }
  };

  const handleDownloadSeason = async (seasonNumber: number) => {
    if (!item || item.type !== "series") return;
    setIsDownloading(true);
    setActionError(null);
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "season",
          itemId: item.id,
          name: item.title,
          seriesId: item.id,
          seriesName: item.title,
          seasonNumber,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to start download");
      router.push("/queue");
    } catch (error) {
      console.error("Error starting season download:", error);
      setActionError(error instanceof Error ? error.message : "No se pudo iniciar la descarga");
      setIsDownloading(false);
    }
  };

  const handleDownloadEpisode = async (episode: Episode) => {
    if (!item || item.type !== "series") return;
    setIsDownloading(true);
    setActionError(null);
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "episode",
          itemId: episode.id,
          name: episode.name,
          seriesId: item.id,
          seriesName: item.title,
          seasonNumber: episode.seasonNumber,
          episodeNumber: episode.episodeNumber,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Failed to start download");
      router.push("/queue");
    } catch (error) {
      console.error("Error starting episode download:", error);
      setActionError(error instanceof Error ? error.message : "No se pudo iniciar la descarga");
      setIsDownloading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container px-4 py-6">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="container flex min-h-[400px] items-center justify-center px-4">
        <p className="text-muted-foreground">Item no encontrado</p>
      </div>
    );
  }

  return (
    <div className="container px-4 py-6">
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => router.back()}>
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      <div className="flex flex-col gap-6">
        {hasBackdrop && item.backdropUrl && (
          <div className="relative -mx-4 -mt-6 aspect-video w-[calc(100%+2rem)] overflow-hidden sm:-mx-6 sm:-mt-6">
            <Image
              src={item.backdropUrl}
              alt={item.title}
              fill
              className="object-cover"
              priority
              onError={() => setHasBackdrop(false)}
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background via-background/80 to-transparent" />
          </div>
        )}

        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          {item.posterUrl && (
            <div className="shrink-0">
              <div className="relative aspect-[2/3] w-48 overflow-hidden rounded-lg shadow-lg">
                <Image src={item.posterUrl} alt={item.title} fill className="object-cover" />
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">{item.title}</h1>
                {item.year && <span className="text-muted-foreground">({item.year})</span>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">{item.type === "movie" ? "Película" : "Serie"}</Badge>
                {item.officialRating && <Badge variant="outline">{item.officialRating}</Badge>}
              </div>
            </div>

            {item.overview && <p className="text-muted-foreground">{item.overview}</p>}

            {item.genres && item.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.genres.map((genre) => (
                  <Badge key={genre} variant="secondary" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 rounded-lg border bg-card p-4 sm:grid-cols-4">
              {item.size !== undefined && item.size > 0 && (
                <div className="flex items-center gap-2">
                  <HardDrive className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Tamaño</span>
                    <span className="font-semibold">{formatBytes(item.size)}</span>
                  </div>
                </div>
              )}
              {item.runtime !== undefined && item.runtime > 0 && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Duración</span>
                    <span className="font-semibold">{formatRuntime(item.runtime)}</span>
                  </div>
                </div>
              )}
              {item.container && (
                <div className="flex items-center gap-2">
                  <Film className="h-4 w-4 text-muted-foreground" />
                  <div className="flex flex-col">
                    <span className="text-xs text-muted-foreground">Contenedor</span>
                    <span className="font-semibold uppercase">{item.container}</span>
                  </div>
                </div>
              )}
              {item.resolution && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Resolución</span>
                  <span className="font-semibold">{item.resolution}</span>
                </div>
              )}
            </div>

            {item.audioTracks && item.audioTracks.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Pistas de Audio ({item.audioTracks.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.audioTracks.map((track, index) => (
                    <Badge key={index} variant={track.isDefault ? "default" : "secondary"} className="text-xs">
                      {track.language}
                      {track.channels && ` (${track.channels}ch)`}
                      {track.isDefault && " •"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {item.subtitleTracks && item.subtitleTracks.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Subtitles className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Subtítulos ({item.subtitleTracks.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.subtitleTracks.map((track, index) => (
                    <Badge key={index} variant={track.isDefault ? "default" : "outline"} className="text-xs">
                      {track.language}
                      {track.isDefault && " •"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {actionError && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                {actionError}
              </div>
            )}

            {item.type === "movie" && (
              <Button onClick={handleDownloadMovie} disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? "Añadiendo..." : "Descargar película"}
              </Button>
            )}

            {item.type === "series" && (
              <Button onClick={handleDownloadSeries} disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? "Añadiendo..." : "Descargar serie completa"}
              </Button>
            )}
          </div>
        </div>

        {item.type === "series" && item.seasons && item.seasons.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Temporadas</h2>

            <div className="flex flex-wrap gap-2">
              {item.seasons.map((season) => (
                <Button
                  key={season.seasonNumber}
                  variant={selectedSeason === season.seasonNumber ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedSeason(season.seasonNumber)}
                >
                  <Tv className="mr-2 h-4 w-4" />
                  T{season.seasonNumber}
                </Button>
              ))}
            </div>

            {selectedSeason !== null && (
              <Button onClick={() => handleDownloadSeason(selectedSeason)} disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? "Añadiendo..." : `Descargar temporada ${selectedSeason}`}
              </Button>
            )}

            {selectedSeasonData && selectedSeasonData.episodes && (
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold">Episodios ({selectedSeasonData.episodeCount})</h3>
                <ScrollArea className="h-[500px]">
                  <div className="flex flex-col gap-2 pr-4">
                    {selectedSeasonData.episodes.map((episode) => (
                      <div key={episode.id} className="rounded-lg border bg-card p-4">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">E{episode.episodeNumber}</Badge>
                            <span className="font-semibold">{episode.name}</span>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => handleDownloadEpisode(episode)} disabled={isDownloading}>
                            <Download className="mr-2 h-4 w-4" />
                            Descargar
                          </Button>
                        </div>
                        {episode.overview && <p className="text-sm text-muted-foreground">{episode.overview}</p>}
                        {episode.runtime && (
                          <span className="text-xs text-muted-foreground">{formatRuntime(episode.runtime)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
