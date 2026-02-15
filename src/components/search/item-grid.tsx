import { ItemCard } from "@/components/shared/item-card";
import { ItemGridSkeleton } from "@/components/shared/loading-skeleton";

export interface SearchItem {
  id: string;
  title: string;
  year?: number;
  type: "movie" | "series";
  posterUrl?: string;
  size?: number; // Size in bytes
}

interface ItemGridProps {
  items: SearchItem[];
  isLoading?: boolean;
}

export function ItemGrid({ items, isLoading }: ItemGridProps) {
  if (isLoading) {
    return <ItemGridSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-center text-muted-foreground">
          No se encontraron resultados
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <ItemCard
          key={item.id}
          id={item.id}
          title={item.title}
          year={item.year}
          type={item.type}
          posterUrl={item.posterUrl}
          size={item.size}
        />
      ))}
    </div>
  );
}
