const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://api:8000',
      changeOrigin: true,
      timeout: 30000,
      onError: (err, req, res) => {
        console.log('Proxy Error:', err.message);
        res.status(500).send('Proxy Error: ' + err.message);
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying request:', req.method, req.url);
      }
    })
  );
};