import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { MobileScrollToTopOnRoute } from './components/MobileScrollToTopOnRoute.tsx';
import { applyFontPreset, getStoredFontPresetId } from './fontTheme';
import './index.css';
import App from './App.tsx';
import { CriterionLearnPage } from './screens/CriterionLearnPage.tsx';
import { MasterArticlePage } from './screens/MasterArticlePage.tsx';

applyFontPreset(getStoredFontPresetId());

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <HashRouter>
        <MobileScrollToTopOnRoute />
        <Routes>
          <Route path="/" element={<App />} />
          <Route path="/master/:slug" element={<MasterArticlePage />} />
          <Route path="/learn/criterion/:criterionSlug" element={<CriterionLearnPage />} />
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  </StrictMode>
);
