import { Capacitor } from "@capacitor/core";

/** App rodando dentro do shell nativo (iOS/Android via Capacitor). */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform();
}

export function nativePlatform(): "ios" | "android" | "web" {
  return Capacitor.getPlatform() as "ios" | "android" | "web";
}
