import { cn } from "@/lib/utils";

interface ProgressBarProps {
  progress: number;
  className?: string;
  showPercentage?: boolean;
}

export function ProgressBar({
  progress,
  className,
  showPercentage = true,
}: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all duration-300 ease-out"
          style={{ width: `${clampedProgress}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-xs text-muted-foreground min-w-[3rem] text-right">
          {Math.round(clampedProgress)}%
        </span>
      )}
    </div>
  );
}
