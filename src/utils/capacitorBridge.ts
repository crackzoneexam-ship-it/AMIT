import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';

export function isNativeAndroid(): boolean {
  try {
    return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
  } catch {
    return false;
  }
}

export function registerBackButtonHandler(onBack: () => boolean): () => void {
  if (!Capacitor.isNativePlatform()) {
    return () => {};
  }

  let removed = false;
  let listenerHandle: { remove: () => Promise<void> } | null = null;

  CapApp.addListener('backButton', ({ canGoBack }) => {
    const handled = onBack();
    if (!handled) {
      if (canGoBack) {
        window.history.back();
      } else {
        CapApp.exitApp();
      }
    }
  }).then((handle) => {
    if (removed) {
      handle.remove().catch(() => {});
    } else {
      listenerHandle = handle;
    }
  }).catch(() => {});

  return () => {
    removed = true;
    listenerHandle?.remove().catch(() => {});
  };
}
