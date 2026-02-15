import { ItemGridSkeleton } from "@/components/shared/loading-skeleton";

export default function SearchLoading() {
  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col gap-6">
        <div className="h-9 w-full animate-pulse rounded-md bg-muted" />
        <div className="flex gap-2">
          <div className="h-8 w-20 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-24 animate-pulse rounded-md bg-muted" />
          <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
        </div>
        <ItemGridSkeleton />
      </div>
    </div>
  );
}
