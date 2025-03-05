// src/utils/useStore.js
import { reactive } from 'vue';

export const store = reactive({
  loggedIn: false,

  // Method to check the token and update the login state
  checkLoginStatus() {
    const token = localStorage.getItem('token');
    this.loggedIn = token ? true : false;  // Set loggedIn based on token presence
  },

  // Method to logout the user
  logout() {
    this.loggedIn = false;
    localStorage.removeItem('token');
  }
});
