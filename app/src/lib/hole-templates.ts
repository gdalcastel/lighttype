import type { HoleTemplate } from "@/types";

const STORAGE_KEY = "lighttype-hole-templates";

export function loadHoleTemplates(): HoleTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HoleTemplate[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function persistHoleTemplates(templates: HoleTemplate[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

let templateCounter = 0;

export function newHoleTemplateId() {
  return `tpl-${Date.now()}-${++templateCounter}`;
}
