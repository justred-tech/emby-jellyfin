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

  useEffect(() => {
    const fetchItems = async () => {
      if (!searchQuery.trim()) {
        setItems([]);
        return;
      }

      setIsLoading(true);
      try {
        const params = new URLSearchParams({
          q: searchQuery,
          ...(filter !== "all" && {
            type: filter === "movies" ? "Movie" : "Series",
          }),
        });

        const response = await fetch(`/api/emby/search?${params}`);
        if (!response.ok) throw new Error("Failed to fetch");
        const data = await response.json();

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
        {isLoading && searchQuery ? (
          <ItemGridSkeleton />
        ) : (
          <ItemGrid items={items} />
        )}
      </div>
    </div>
  );
}
