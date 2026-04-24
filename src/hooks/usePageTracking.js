import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { trackPage } from '@/lib/analytics';

export function usePageTracking() {
  const location = useLocation();

  useEffect(() => {
    const pageName = location.pathname.replace('/', '') || 'Home';
    trackPage(pageName);
  }, [location.pathname]);
}
