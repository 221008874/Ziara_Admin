# Environment & Configuration

## Client-Side (.env / VITE_*)

All VITE_* variables are exposed to the browser.

VITE_FIREBASE_API_KEY              Firebase Web API key
VITE_FIREBASE_AUTH_DOMAIN          Firebase Auth domain
VITE_FIREBASE_PROJECT_ID           Firebase project ID
VITE_FIREBASE_STORAGE_BUCKET       Firebase storage bucket
VITE_FIREBASE_MESSAGING_SENDER_ID  Firebase messaging sender ID
VITE_FIREBASE_APP_ID               Firebase app ID
VITE_CLOUDINARY_CLOUD_NAME         Cloudinary cloud name
VITE_CLOUDINARY_UPLOAD_PRESET      Cloudinary unsigned upload preset
VITE_API_BASE                      Optional API base URL (default: "")

## Server-Side (Vercel Environment Variables)

FIREBASE_SERVICE_ACCOUNT_JSON_BASE64  Base64-encoded Firebase Admin SDK JSON
GMAIL_USER                            Gmail address for SMTP
GMAIL_APP_PASSWORD                    Gmail app-specific password
OWNER_EMAIL                           Owner email for OTP notifications

## Scripts (package.json)

npm run dev        Start Vite dev server (hot reload)
npm run build      Production build -> dist/
npm run preview    Preview production build locally
npm run lint       Run ESLint on src/

## Build Configuration (vite.config.js)

export default defineConfig({
  plugins: [react()],
});

## Deployment (vercel.json)

{
  "version": 2,
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "functions": {
    "api/**/*.js": { "maxDuration": 10 }
  },
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/api/$1" },
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}

API functions limited to 10 seconds max duration.
SPA fallback for all non-API routes.

## Firebase Configuration (firebase.json)

{
  "firestore": {
    "rules": "firestore.rules"
  }
}

Only Firestore rules are configured. No hosting, functions, or other Firebase services.

## ESLint (eslint.config.js)

- Flat config (ESLint 9.x)
- Extends: js.configs.recommended
- Plus: react-hooks + react-refresh plugins
- Ignored: dist/
- Custom: no-unused-vars with varsIgnorePattern: "^[A-Z_]"
