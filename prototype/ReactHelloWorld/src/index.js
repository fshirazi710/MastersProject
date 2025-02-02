import React from 'react';
import ReactDOM from 'react-dom/client';

import MyComponent from './app';
import NewComponent from './new';

const contents = (
  <div>
    <MyComponent/>
    <NewComponent/>
  </div>
);

ReactDOM.createRoot(document.getElementById('app')).render(contents);