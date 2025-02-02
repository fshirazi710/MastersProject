import React from 'react';
import ReactDOM from 'react-dom/client';

import {App, LoginSystemTitle} from './app';
import './style.css';

const contents = (
  <div>
    <LoginSystemTitle/>
    <App/>
  </div>
);

ReactDOM.createRoot(
  document.getElementById('main')
).render(contents);
