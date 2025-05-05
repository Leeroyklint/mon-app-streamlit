import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import App from './App';
createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter, null,
    React.createElement(App, null)));
