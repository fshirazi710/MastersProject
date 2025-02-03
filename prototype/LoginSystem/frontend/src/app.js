import React from 'react';
import LoginForm from './loginForm'

function LoginSystemTitle() {
  return <h1>Simple Login System</h1>;
}

function App() {
  return <LoginForm />;
}

export {App as App, LoginSystemTitle as LoginSystemTitle};
