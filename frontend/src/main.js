import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import "./theme.css";
import './index.css';
import App from './App';
import React from 'react';
createRoot(document.getElementById('root')).render(React.createElement(BrowserRouter, null,
    React.createElement(StrictMode, null,
        React.createElement(App, null))));
