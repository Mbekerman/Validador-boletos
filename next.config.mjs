/** @type {import('next').NextConfig} */
export default {
  output: "standalone",
  poweredByHeader: false,
  experimental: {
    // O app também é servido pelo Firebase Hosting (validaboleto.web.app), que encaminha ao Cloud Run.
    serverActions: { allowedOrigins: ["validaboleto.web.app", "validaboleto.firebaseapp.com"] },
  },
};
