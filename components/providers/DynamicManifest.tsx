'use client';

import { usePathname } from 'next/navigation';

export function DynamicManifest() {
  const pathname = usePathname() || '';
  
  let manifestUrl = '';
  if (pathname.startsWith('/superadmin')) {
    manifestUrl = '/manifest-superadmin.json';
  } else if (pathname.startsWith('/committee')) {
    manifestUrl = '/manifest-committee.json';
  } else if (pathname.startsWith('/community')) {
    manifestUrl = '/manifest-community.json';
  } else if (pathname.startsWith('/turf-manager')) {
    manifestUrl = '/manifest-turf-manager.json';
  } else if (pathname.startsWith('/shareholder')) {
    manifestUrl = '/manifest-shareholder.json';
  }

  if (!manifestUrl) return null;

  return <link rel="manifest" href={manifestUrl} />;
}
