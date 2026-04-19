import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const ARRAY_CANDIDATE_KEYS = ["data", "items", "result", "records", "content"] as const;

/**
 * Normalizza la risposta API in array, gestendo i pattern:
 * - array diretto
 * - { data: [...] }
 * - { items: [...] }
 */
export function normalizeArray<T>(value: any): T[] {
  const seen = new Set<any>();
  const stack = [value];

  while (stack.length > 0) {
    const current = stack.shift();

    if (Array.isArray(current)) {
      return current as T[];
    }

    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }

    seen.add(current);

    for (const key of ARRAY_CANDIDATE_KEYS) {
      if (key in current) {
        stack.push(current[key]);
      }
    }
  }

  return [];
}
