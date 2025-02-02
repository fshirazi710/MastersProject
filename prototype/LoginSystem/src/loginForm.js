import React, { useState } from 'react';

function LoginForm() {
  const password = 'swordfish';
  const email = 'email@gmail.com';

  const [authorized, setAuthorized] = useState(false);

  function handleSubmit(e) {
    const enteredEmail = e.target.querySelector(
      'input[type="email"]').value;

    const enteredPassword = e.target.querySelector(
      'input[type="password"]').value;

    const auth = enteredPassword === password && enteredEmail == email;
    setAuthorized(auth)
  }

  const login = (
    <form action = "#" onSubmit = {handleSubmit}>
      <h2>Enter Email</h2>
      <input type = "email" placeholder = "Email"/> <br/>
      <h2>Enter Password</h2>
      <input type = "password" placeholder = "Password"/> <br/> <br/>
      <input type = "submit" value = "Submit"/>
    </form>
  );

  const electionInfo = (
    <div>
      <h1>
        Voting system
      </h1>
      <h2>
        List of open elections
      </h2>
    </div>
  );

  return (
      <div id="authorization" className = "authorization_form">
        {authorized ? electionInfo : login}
      </div>
  );
}

export default LoginForm;