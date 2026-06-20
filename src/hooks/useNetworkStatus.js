import { useState, useEffect } from 'react';

/**
 * useNetworkStatus — tracks online/offline browser state.
 * Returns { isOnline, wasOffline }
 * wasOffline stays true after recovery so app can auto-sync.
 */
export function useNetworkStatus() {
  const [isOnline,   setIsOnline]   = useState(() => navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);

  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  setWasOffline(true); };
    const goOffline = () => { setIsOnline(false); };
    window.addEventListener('online',  goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online',  goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return { isOnline, wasOffline };
}
