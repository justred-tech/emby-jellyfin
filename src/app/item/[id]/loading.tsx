import { Skeleton } from "@/components/ui/skeleton";

export default function ItemLoading() {
  return (
    <div className="container px-4 py-6">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-64 w-full" />
        <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
          <Skeleton className="aspect-[2/3] h-48 w-48" />
          <div className="flex flex-1 flex-col gap-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </div>
  );
}
