import React from 'react';
import ReactDOM from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from './store/AuthContext';
import App from './app/App';
import './styles.css';

// Check if this window was opened with a specific route via URL hash
const hash = window.location.hash.replace('#', '');
const initialRoute = hash === 'pos' ? '/pos' : '/';
const isPOSWindow = hash === 'pos';

const root = ReactDOM.createRoot(document.getElementById('root'));

root.render(
  <MemoryRouter initialEntries={[initialRoute]}>
    <AuthProvider>
      <App isPOSWindow={isPOSWindow} />
    </AuthProvider>
  </MemoryRouter>
);
