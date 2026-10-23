import { createRoot } from 'react-dom/client';
import '@fontsource/pixelify-sans/400.css';
import '@fontsource/pixelify-sans/600.css';
import '@fontsource/silkscreen/400.css';
import './index.css';
import { App } from './App';
import { loadSettings } from './db/settings';

void loadSettings();
createRoot(document.getElementById('root')!).render(<App />);
