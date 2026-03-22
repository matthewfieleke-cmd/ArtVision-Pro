import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { applyFontPreset, getStoredFontPresetId } from './fontTheme';
import './index.css';
import App from './App.tsx';
import { MasterArticlePage } from './screens/MasterArticlePage.tsx';

applyFontPreset(getStoredFontPresetId());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/master/:slug" element={<MasterArticlePage />} />
      </Routes>
    </HashRouter>
  </StrictMode>
);
