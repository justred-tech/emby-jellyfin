"use client";

import { useState, useEffect } from "react";
import { SearchBar } from "@/components/search/search-bar";
import { FilterChips } from "@/components/search/filter-chips";
import { ItemGrid, type SearchItem } from "@/components/search/item-grid";
import { ItemGridSkeleton } from "@/components/shared/loading-skeleton";

type FilterType = "all" | "movies" | "series";

export default function SearchPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [items, setItems] = useState<SearchItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      if (!searchQuery.trim()) {
        setItems([]);
        setErrorMessage(null);
        return;
      }

      setIsLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          ...(filter !== "all" && {
            type: filter === "movies" ? "Movie" : "Series",
          }),
        });

        const response = await fetch(`/api/emby/search?${params}`);
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data?.error || "No se pudo buscar en Emby");
        }

        // Map Emby items to SearchItem format
        const mappedItems = (data.items || []).map((item: any) => ({
          id: item.Id,
          title: item.Name,
          year: item.ProductionYear,
          type: item.Type?.toLowerCase() === 'movie' ? 'movie' as const : 'series' as const,
          posterUrl: item.Id ? `/api/emby/items/${item.Id}/image` : undefined,
          size: item.Size || item.MediaSources?.[0]?.Size,
        }));

        setItems(mappedItems);
      } catch (error) {
        console.error("Error fetching items:", error);
        setItems([]);
        setErrorMessage(error instanceof Error ? error.message : "Error de búsqueda");
      } finally {
        setIsLoading(false);
      }
    };

    const timer = setTimeout(fetchItems, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, filter]);

  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col gap-6">
        <SearchBar value={searchQuery} onChange={setSearchQuery} />
        <FilterChips value={filter} onChange={setFilter} />
        {!searchQuery.trim() ? (
          <div className="flex min-h-[220px] items-center justify-center rounded-lg border border-dashed">
            <p className="text-center text-sm text-muted-foreground">
              Escribe algo para buscar en Emby
            </p>
          </div>
        ) : isLoading ? (
          <ItemGridSkeleton />
        ) : errorMessage ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            Error de búsqueda: {errorMessage}
          </div>
        ) : (
          <ItemGrid items={items} />
        )}
      </div>
    </div>
  );
}
