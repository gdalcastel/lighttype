"use client";

import { create } from "zustand";
import { DEFAULT_PROJECT, type ProjectConfig } from "@/types";

type ViewerState = {
  showInterior: boolean;
  showLed: boolean;
  showBar: boolean;
  cameraView: "free" | "front" | "back" | "side" | "reset";
};

type CreatorState = ProjectConfig &
  ViewerState & {
    setText: (text: string) => void;
    setFontId: (fontId: string) => void;
    patch: (partial: Partial<ProjectConfig>) => void;
    setViewer: (partial: Partial<ViewerState>) => void;
    reset: () => void;
  };

export const useCreatorStore = create<CreatorState>((set) => ({
  ...DEFAULT_PROJECT,
  showInterior: false,
  showLed: true,
  showBar: true,
  cameraView: "front",
  setText: (text) => set({ text: text.slice(0, 48) }),
  setFontId: (fontId) => set({ fontId }),
  patch: (partial) => set(partial),
  setViewer: (partial) => set(partial),
  reset: () => set({ ...DEFAULT_PROJECT, cameraView: "reset" }),
}));
