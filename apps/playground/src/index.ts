import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './App';

const rootEl = document.getElementById('root');
if (rootEl) {
  ReactDOM.createRoot(rootEl).render(
    React.createElement(React.StrictMode, null, React.createElement(App))
  );
}
