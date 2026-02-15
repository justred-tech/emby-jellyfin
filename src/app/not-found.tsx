import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-[400px] items-center justify-center px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="text-muted-foreground">
          La página que buscas no existe
        </p>
        <Button asChild>
          <Link href="/search">Volver al inicio</Link>
        </Button>
      </div>
    </div>
  );
}
