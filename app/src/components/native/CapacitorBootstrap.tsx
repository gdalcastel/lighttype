"use client";

import { useEffect } from "react";
import { StatusBar, Style } from "@capacitor/status-bar";
import { Keyboard } from "@capacitor/keyboard";
import { isNativeApp } from "@/lib/native";

/** Ajustes nativos leves ao abrir o app Capacitor. */
export function CapacitorBootstrap() {
  useEffect(() => {
    if (!isNativeApp()) return;

    void StatusBar.setStyle({ style: Style.Light }).catch(() => undefined);
    void StatusBar.setBackgroundColor({ color: "#f7f3ee" }).catch(() => undefined);

    const show = Keyboard.addListener("keyboardWillShow", () => {
      document.documentElement.classList.add("keyboard-open");
    });
    const hide = Keyboard.addListener("keyboardWillHide", () => {
      document.documentElement.classList.remove("keyboard-open");
    });

    return () => {
      void show.then((h) => h.remove());
      void hide.then((h) => h.remove());
    };
  }, []);

  return null;
}
