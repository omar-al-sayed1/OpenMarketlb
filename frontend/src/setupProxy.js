// Local dev proxy: forwards API and WebSocket traffic from the React dev
// server (port 3000) to the FastAPI backend (port 8001). This lets the
// Google OAuth callback (http://localhost:3000/api/auth/google/callback)
// reach the backend, matching the single-origin setup the app expects.
const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true,
    })
  );
  app.use(
    '/ws',
    createProxyMiddleware({
      target: 'http://localhost:8001',
      changeOrigin: true,
      ws: true,
    })
  );
};
