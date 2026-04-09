// Utility function to force light mode and clear any dark class
export const forceLightMode = () => {
  // Remove dark class from HTML element
  document.documentElement.classList.remove('dark');

  // Force set theme to light in localStorage (overwrite any existing value)
  localStorage.setItem('theme', 'light');

  // Dispatch custom event to notify other components
  window.dispatchEvent(
    new CustomEvent('themeChanged', {
      detail: {
        theme: 'light',
        isDarkMode: false,
      },
    })
  );

  console.log('✅ Forced light mode - dark class removed from HTML element');
  console.log('Current HTML classes:', document.documentElement.className);
  console.log('Theme set to:', localStorage.getItem('theme'));
};

// Function to check and fix theme on page load
export const initializeLightMode = () => {
  const savedTheme = localStorage.getItem('theme');

  // Always force light mode unless explicitly set to dark
  if (savedTheme !== 'dark') {
    forceLightMode();
  }
};

// Auto-initialize on import (for immediate effect)
if (typeof window !== 'undefined') {
  // Run immediately - force light mode
  forceLightMode();

  // Also run when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', forceLightMode);
  }

  // Run on window load as well
  window.addEventListener('load', forceLightMode);
}
