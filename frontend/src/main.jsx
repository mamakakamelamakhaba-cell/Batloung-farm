import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { AuthProvider, ToastProvider } from './context';
import './styles.css';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ToastProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ToastProvider>
  </React.StrictMode>
);
