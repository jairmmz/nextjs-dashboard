import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login'
    },

    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoogedIn = !!auth?.user;
            const isOnDashboard = nextUrl.pathname.startsWith('/dashboard');

            if (isOnDashboard) {
                if (isLoogedIn) return true;
                return false; // Redirige al usuario al login page.
            } else if (isLoogedIn) {
                return Response.redirect(new URL('/dashboard', nextUrl));
            }
            return true;
        },
    },
    
    providers: [], // Añadir providers
    
} satisfies NextAuthConfig;