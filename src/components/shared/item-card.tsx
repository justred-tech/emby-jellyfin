import Link from "next/link";
import Image from "next/image";
import { Film, Tv } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface ItemCardProps {
  id: string;
  title: string;
  year?: number;
  type: "movie" | "series";
  posterUrl?: string;
  size?: number; // Size in bytes
  className?: string;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

export function ItemCard({
  id,
  title,
  year,
  type,
  posterUrl,
  size,
  className,
}: ItemCardProps) {
  return (
    <Link
      href={`/item/${id}`}
      className={cn(
        "group relative flex flex-col gap-2 overflow-hidden rounded-lg border bg-card transition hover:shadow-md",
        className
      )}
    >
      <div className="relative aspect-[2/3] overflow-hidden bg-muted">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={title}
            fill
            sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
            className="object-cover transition group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            {type === "movie" ? (
              <Film className="h-12 w-12 text-muted-foreground" />
            ) : (
              <Tv className="h-12 w-12 text-muted-foreground" />
            )}
          </div>
        )}
        <Badge
          variant="secondary"
          className="absolute right-2 top-2 text-xs"
        >
          {type === "movie" ? "Película" : "Serie"}
        </Badge>
      </div>
      <div className="flex flex-col gap-1 px-3 pb-3">
        <h3 className="line-clamp-2 font-semibold leading-tight">{title}</h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {year && <span>{year}</span>}
          {size !== undefined && size > 0 && (
            <>
              {year && <span>·</span>}
              <span>{formatSize(size)}</span>
            </>
          )}
        </div>
      </div>
    </Link>
  );
}
