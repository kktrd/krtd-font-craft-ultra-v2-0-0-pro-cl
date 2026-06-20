import { useState, useEffect, useCallback } from 'react';

/**
 * useInstallPrompt — captures the native PWA install prompt (Chrome/Edge/Android).
 * iOS Safari has no beforeinstallprompt event — canInstall stays false there;
 * iOS users add via Share → "Add to Home Screen" manually.
 */
export function useInstallPrompt() {
  const [deferredEvent, setDeferredEvent] = useState(null);
  const [isInstalled,   setIsInstalled]   = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e) => {
      e.preventDefault();
      setDeferredEvent(e);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredEvent(null);
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);

    // Already running as installed PWA?
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredEvent) return false;
    deferredEvent.prompt();
    const { outcome } = await deferredEvent.userChoice;
    setDeferredEvent(null);
    return outcome === 'accepted';
  }, [deferredEvent]);

  return {
    canInstall: !!deferredEvent && !isInstalled,
    isInstalled,
    promptInstall,
  };
}
