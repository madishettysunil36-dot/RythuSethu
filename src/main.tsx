import {createRoot} from 'react-dom/client';
import {registerSW} from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';

declare global {
  interface Window {
    gm_authFailure?: () => void;
  }
}

// Tier-1 Google Maps Platform quota/auth failure handler (must be registered before React mounts)
window.gm_authFailure = () => {
  window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
};

const origConsoleError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  const joined = args.map((a) => String(a ?? '')).join(' ');
  if (
    joined.includes('OverQuotaMapError') ||
    joined.includes('QuotaExceededError') ||
    joined.includes('OVER_QUERY_LIMIT') ||
    joined.includes('RESOURCE_EXHAUSTED')
  ) {
    window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
  }
  origConsoleError(...args);
};

registerSW({immediate: true});

createRoot(document.getElementById('root')!).render(<App />);
