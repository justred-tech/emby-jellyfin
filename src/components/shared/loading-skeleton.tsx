import { Skeleton } from "@/components/ui/skeleton";

export function ItemCardSkeleton() {
  return (
    <div className="flex flex-col gap-2 overflow-hidden rounded-lg border">
      <Skeleton className="aspect-[2/3] w-full" />
      <div className="flex flex-col gap-2 px-3 pb-3">
        <Skeleton className="h-5 w-full" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function ItemGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: count }).map((_, i) => (
        <ItemCardSkeleton key={i} />
      ))}
    </div>
  );
}
