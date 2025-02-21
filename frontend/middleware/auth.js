export default defineNuxtRouteMiddleware(async (to, from) => {
    // Check if running on the client side
    const token = process.client ? localStorage.getItem('token') : null;

    // If no token, redirect to login
    if (!token) {
        return navigateTo('/login'); // Redirect to login page if no token
    }
});