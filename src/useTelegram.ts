import { useEffect, useMemo } from 'react';

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
};

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  close: () => void;
  colorScheme?: 'light' | 'dark';
  initDataUnsafe?: {
    user?: TelegramUser;
  };
  HapticFeedback?: {
    impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
    notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
    selectionChanged: () => void;
  };
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
};

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
    };
  }
}

export function useTelegram() {
  const webApp = window.Telegram?.WebApp;

  useEffect(() => {
    webApp?.ready();
    webApp?.expand();
    webApp?.setHeaderColor?.('#0f8f4f');
    webApp?.setBackgroundColor?.('#eef8f0');
  }, [webApp]);

  return useMemo(
    () => ({
      webApp,
      user: webApp?.initDataUnsafe?.user,
      impact: (style: 'light' | 'medium' | 'heavy' = 'light') =>
        webApp?.HapticFeedback?.impactOccurred(style),
      notify: (type: 'error' | 'success' | 'warning') =>
        webApp?.HapticFeedback?.notificationOccurred(type),
      select: () => webApp?.HapticFeedback?.selectionChanged(),
    }),
    [webApp],
  );
}
