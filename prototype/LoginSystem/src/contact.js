import React, { useState } from 'react';

function Contact() {
  const password = 'swordfish';
  const email = 'email';

  const [authorized, setAuthorized] = useState(false);

  function handleSubmit(e) {
    const enteredEmail = e.target.querySelector(
      'input[type="email"]').value;

    const enteredPassword = e.target.querySelector(
      'input[type="password"]').value;

    const auth = enteredPassword == password && enteredEmail == email;
    setAuthorized(auth)
  }

  const login = (
    <form action = "#" onSubmit = {handleSubmit}>
      <h2>Enter Email</h2>
      <input type = "email" placeholder = "Email"/> <br/>
      <h2>Enter Password</h2>
      <input type = "password" placeholder = "Password"/> <br/> <br/>
      <input type = "submit" />
    </form>
  );

  const electionInfo = (
    <ul>
      <li>
        Voting system
      </li>
      <li>
        List of open elections
      </li>
    </ul>
  );

  return (
      <div id="authorization">
        {authorized ? electionInfo : login}
      </div>
  );
}

export default Contact;