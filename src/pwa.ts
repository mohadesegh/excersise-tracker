/** Service-worker registration and the "install app" prompt. */

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferred: BeforeInstallPromptEvent | null = null;
const listeners = new Set<() => void>();

export const canInstall = (): boolean => !!deferred;
export const isStandalone = (): boolean =>
  matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
export const isIOS = (): boolean => /iphone|ipad|ipod/i.test(navigator.userAgent);
export const onInstallChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

export async function install(): Promise<boolean> {
  if (!deferred) return false;
  await deferred.prompt();
  const { outcome } = await deferred.userChoice;
  deferred = null;
  listeners.forEach((f) => f());
  return outcome === 'accepted';
}

export function initPWA(): void {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    listeners.forEach((f) => f());
  });
  window.addEventListener('appinstalled', () => {
    deferred = null;
    listeners.forEach((f) => f());
  });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        /* hosting without a service worker: the app still works online */
      });
    });
  }
}
