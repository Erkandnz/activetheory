import { createRoot } from 'react-dom/client';
import App from './App';
import './activeTheory.css';

const rootElement = document.getElementById('root');

if (rootElement) {
  createRoot(rootElement).render(<App />);
}
