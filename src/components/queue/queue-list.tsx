import { QueueItem } from "@/stores/queue.store";
import { QueueItemComponent } from "./queue-item";

interface QueueListProps {
  items: QueueItem[];
  onCancel?: (id: string) => void;
}

export function QueueList({
  items,
  onCancel,
}: QueueListProps) {
  if (items.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <p className="text-center text-muted-foreground">
          No hay descargas en cola
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {items.map((item) => (
        <QueueItemComponent
          key={item.id}
          item={item}
          onCancel={onCancel}
        />
      ))}
    </div>
  );
}
