import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';
import { LabPage } from './lab/LabPage';

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element #root not found');
}

const path = window.location.pathname.replace(/\/+$/, '') || '/';
const page = path === '/lab' ? <LabPage /> : <App />;

createRoot(root).render(<StrictMode>{page}</StrictMode>);
