import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import App from './app/App';
import './styles.css';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <MemoryRouter>
    <AuthProvider>
      <App />
    </AuthProvider>
  </MemoryRouter>
);
