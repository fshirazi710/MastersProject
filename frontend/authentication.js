// src/utils/useStore.js
import { reactive } from 'vue';

export const store = reactive({
  loggedIn: false,
  user: null,

  // Method to check the token and update the login state
  checkLoginStatus() {
    const token = localStorage.getItem('token');
    this.loggedIn = !!token;  // Convert to boolean
    
    // Try to parse the token to get user info
    if (token) {
      try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        this.user = {
          email: payload.sub
        };
      } catch (e) {
        console.error('Error parsing token:', e);
        this.logout();  // Clear invalid token
      }
    } else {
      this.user = null;
    }
  },

  // Method to set the logged-in state
  setLoggedIn(token) {
    localStorage.setItem('token', token);
    this.checkLoginStatus();
  },

  // Method to logout the user
  logout() {
    this.loggedIn = false;
    this.user = null;
    localStorage.removeItem('token');
  },
  
  // Method to get the token
  getToken() {
    return localStorage.getItem('token');
  },
  
  // Method to check if user is authenticated
  isAuthenticated() {
    return this.loggedIn && !!this.getToken();
  }
});
