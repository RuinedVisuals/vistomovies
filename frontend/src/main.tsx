import React from 'react';
import ReactDOM from 'react-dom/client';
import './lib/pwa';
import ShowtimesApp from './ShowtimesApp';
import './styles/main.css';
import './styles/responsive.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><ShowtimesApp/></React.StrictMode>);
