'use client';

import { useEffect, useState } from 'react';

export function useScreenshotBlocker() {
  const [isBlurred, setIsBlurred] = useState(false);

  useEffect(() => {
    // Blur when window loses focus (often happens when snipping tool is opened)
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);
    
    // Prevent copy/paste
    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      alert("Copying data from the finance module is restricted.");
    };

    // Attempt to block PrintScreen key
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'PrintScreen' || e.code === 'PrintScreen' || (e.ctrlKey && e.key === 'p') || (e.metaKey && e.key === 'p')) {
        setIsBlurred(true);
        alert("Screenshots and printing are disabled for security reasons.");
        
        // Try to clear clipboard if they hit PrintScreen
        navigator.clipboard.writeText("").catch(() => {});
      }
    };
    
    // Attempt to block context menu (right click)
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('contextmenu', handleContextMenu);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  return { isBlurred };
}
