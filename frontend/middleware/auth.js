export default defineNuxtRouteMiddleware(async (to, from) => {
    // List of routes that require authentication
    const protectedRoutes = ['/create-vote', '/my-votes'];
    
    // Only check authentication for protected routes
    if (protectedRoutes.includes(to.path)) {
        // Check if running on the client side
        const token = process.client ? localStorage.getItem('token') : null;

        // If no token, redirect to login
        if (!token) {
            return navigateTo('/login', { 
                query: { redirect: to.fullPath },
                replace: true 
            });
        }
    }
});