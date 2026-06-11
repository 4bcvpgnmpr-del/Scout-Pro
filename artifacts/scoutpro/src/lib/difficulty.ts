export const DIFFICULTY_OPTIONS = [
  { value: "importante", label: "Importante" },
  { value: "medio", label: "Medio" },
  { value: "facil", label: "Fácil" },
] as const;

export const DIFFICULTY_LABEL: Record<string, string> = {
  importante: "Importante",
  medio: "Medio",
  facil: "Fácil",
};

export const DIFFICULTY_BADGE: Record<string, string> = {
  importante: "bg-red-500/15 text-red-600 dark:text-red-400",
  medio: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  facil: "bg-green-500/15 text-green-600 dark:text-green-400",
};

export const DIFFICULTY_CELL: Record<string, string> = {
  importante: "bg-red-500/20 border-red-500/50 text-red-700 dark:text-red-300",
  medio: "bg-amber-500/20 border-amber-500/50 text-amber-700 dark:text-amber-300",
  facil: "bg-green-500/20 border-green-500/50 text-green-700 dark:text-green-300",
};

export const DIFFICULTY_DOT: Record<string, string> = {
  importante: "bg-red-500",
  medio: "bg-amber-500",
  facil: "bg-green-500",
};
