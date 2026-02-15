"use client";

import { useEffect, useState } from "react";
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
  episodeNumber: number;
  name: string;
  overview?: string;
  runtime?: number;
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

  useEffect(() => {
    const fetchItem = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(`/api/emby/items/${id}`);
        if (!response.ok) throw new Error("Failed to fetch item");
        const data = await response.json();

        // Get media source info
        const mediaSource = data.item.MediaSources?.[0] || {};
        const mediaStreams = mediaSource.MediaStreams || [];

        const streamVideo = mediaStreams.find((s: MediaStream) => s.Type === 'Video' || s.type === 'Video') || {};
        const streamAudio = mediaStreams.find((s: MediaStream) => s.Type === 'Audio' || s.type === 'Audio') || {};

        // Get all audio tracks
        const audioTracks = mediaStreams
          .filter((s: MediaStream) => s.Type === 'Audio' || s.type === 'Audio')
          .map((s: MediaStream) => ({
            type: s.Type || s.type,
            codec: s.Codec || s.codec,
            language: s.Language || s.language || s.DisplayTitle || s.displayTitle || s.Title || s.title || 'Desconocido',
            isDefault: s.IsDefault || s.isDefault,
            channels: s.Channels || s.channels,
          }));

        // Get all subtitle tracks
        const subtitleTracks = mediaStreams
          .filter((s: MediaStream) => s.Type === 'Subtitle' || s.type === 'Subtitle')
          .map((s: MediaStream) => ({
            type: s.Type || s.type,
            language: s.Language || s.language || s.DisplayTitle || s.displayTitle || s.Title || s.title || 'Desconocido',
            isDefault: s.IsDefault || s.isDefault,
          }));

        // Map Emby item to ItemDetails format
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

  const handleDownload = async () => {
    if (!item) return;
    setIsDownloading(true);
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: item.type,
          itemId: item.id,
          name: item.title,
          year: item.year,
        }),
      });
      if (!response.ok) throw new Error("Failed to start download");
      router.push("/queue");
    } catch (error) {
      console.error("Error starting download:", error);
      setIsDownloading(false);
    }
  };

  const handleDownloadSeason = async (seasonNumber: number) => {
    if (!item) return;
    setIsDownloading(true);
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
      if (!response.ok) throw new Error("Failed to start download");
      router.push("/queue");
    } catch (error) {
      console.error("Error starting download:", error);
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

  const selectedSeasonData = item.seasons?.find(
    (s) => s.seasonNumber === selectedSeason
  );

  return (
    <div className="container px-4 py-6">
      <Button
        variant="ghost"
        size="sm"
        className="mb-4"
        onClick={() => router.back()}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Volver
      </Button>

      <div className="flex flex-col gap-6">
        {/* Backdrop */}
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
          {/* Poster */}
          {item.posterUrl && (
            <div className="shrink-0">
              <div className="relative aspect-[2/3] w-48 overflow-hidden rounded-lg shadow-lg">
                <Image
                  src={item.posterUrl}
                  alt={item.title}
                  fill
                  className="object-cover"
                />
              </div>
            </div>
          )}

          <div className="flex flex-1 flex-col gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold sm:text-3xl">{item.title}</h1>
                {item.year && (
                  <span className="text-muted-foreground">({item.year})</span>
                )}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge variant="secondary">
                  {item.type === "movie" ? "Película" : "Serie"}
                </Badge>
                {item.officialRating && (
                  <Badge variant="outline">{item.officialRating}</Badge>
                )}
              </div>
            </div>

            {item.overview && (
              <p className="text-muted-foreground">{item.overview}</p>
            )}

            {/* Genres */}
            {item.genres && item.genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {item.genres.map((genre) => (
                  <Badge key={genre} variant="secondary" className="text-xs">
                    {genre}
                  </Badge>
                ))}
              </div>
            )}

            {/* Technical Info */}
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
              {item.videoCodec && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Video</span>
                  <span className="font-semibold uppercase">{item.videoCodec}</span>
                </div>
              )}
              {item.audioCodec && (
                <div className="flex flex-col">
                  <span className="text-xs text-muted-foreground">Audio</span>
                  <span className="font-semibold uppercase">{item.audioCodec}</span>
                </div>
              )}
            </div>

            {/* Audio Tracks */}
            {item.audioTracks && item.audioTracks.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Volume2 className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Pistas de Audio ({item.audioTracks.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.audioTracks.map((track, index) => (
                    <Badge
                      key={index}
                      variant={track.isDefault ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {track.language}
                      {track.channels && ` (${track.channels}ch)`}
                      {track.isDefault && " •"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Subtitle Tracks */}
            {item.subtitleTracks && item.subtitleTracks.length > 0 && (
              <div className="rounded-lg border bg-card p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Subtitles className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">Subtítulos ({item.subtitleTracks.length})</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {item.subtitleTracks.map((track, index) => (
                    <Badge
                      key={index}
                      variant={track.isDefault ? "default" : "outline"}
                      className="text-xs"
                    >
                      {track.language}
                      {track.isDefault && " •"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* No subtitles message */}
            {(!item.subtitleTracks || item.subtitleTracks.length === 0) && item.audioTracks && item.audioTracks.length > 0 && (
              <div className="rounded-lg border border-dashed bg-card p-4">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Subtitles className="h-4 w-4" />
                  <span className="text-sm">Sin subtítulos disponibles</span>
                </div>
              </div>
            )}

            {item.type === "movie" && (
              <Button onClick={handleDownload} disabled={isDownloading}>
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? "Añadiendo..." : "Descargar"}
              </Button>
            )}
          </div>
        </div>

        {/* Seasons for series */}
        {item.type === "series" && item.seasons && item.seasons.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-xl font-semibold">Temporadas</h2>

            {/* Season selector */}
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

            {/* Download season button */}
            {selectedSeason !== null && (
              <Button
                onClick={() => handleDownloadSeason(selectedSeason)}
                disabled={isDownloading}
              >
                <Download className="mr-2 h-4 w-4" />
                {isDownloading ? "Añadiendo..." : "Descargar temporada"}
              </Button>
            )}

            {/* Episodes */}
            {selectedSeasonData && selectedSeasonData.episodes && (
              <div className="flex flex-col gap-3">
                <h3 className="font-semibold">
                  Episodios ({selectedSeasonData.episodeCount})
                </h3>
                <ScrollArea className="h-[400px]">
                  <div className="flex flex-col gap-2 pr-4">
                    {selectedSeasonData.episodes.map((episode) => (
                      <div
                        key={episode.episodeNumber}
                        className="flex flex-col gap-1 rounded-lg border bg-card p-4"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">
                            {episode.episodeNumber}
                          </Badge>
                          <span className="font-semibold">{episode.name}</span>
                        </div>
                        {episode.overview && (
                          <p className="text-sm text-muted-foreground">
                            {episode.overview}
                          </p>
                        )}
                        {episode.runtime && (
                          <span className="text-xs text-muted-foreground">
                            {Math.floor(episode.runtime / 60)} min
                          </span>
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
