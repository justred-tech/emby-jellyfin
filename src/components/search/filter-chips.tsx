"use client";

import { Button } from "@/components/ui/button";

type FilterType = "all" | "movies" | "series";

interface FilterChipsProps {
  value: FilterType;
  onChange: (value: FilterType) => void;
}

const filters = [
  { value: "all" as const, label: "Todos" },
  { value: "movies" as const, label: "Películas" },
  { value: "series" as const, label: "Series" },
];

export function FilterChips({ value, onChange }: FilterChipsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          variant={value === filter.value ? "default" : "outline"}
          size="sm"
          onClick={() => onChange(filter.value)}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
