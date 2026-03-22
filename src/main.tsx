import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { applyFontPreset, getStoredFontPresetId } from './fontTheme';
import './index.css';
import App from './App.tsx';

applyFontPreset(getStoredFontPresetId());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
