import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppProvider } from './store';
import { I18nProvider } from './i18n';
import './styles.css';

// 在渲染前应用主题，避免闪烁
const savedTheme = localStorage.getItem('ss_theme') || 'supari';
document.documentElement.dataset.theme = savedTheme;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider>
        <AppProvider>
          <App />
        </AppProvider>
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
