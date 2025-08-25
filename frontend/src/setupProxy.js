const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function (app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://api:8000',
      changeOrigin: true,
      pathRewrite: {
        '^/api': '/api', // Keep the /api prefix
      },
      timeout: 30000,
      logLevel: 'debug',
      onError: (err, req, res) => {
        console.log('Proxy Error:', err.message);
        console.log('Request URL:', req.url);
        res.status(500).send('Proxy Error: ' + err.message);
      },
      onProxyReq: (proxyReq, req, res) => {
        console.log('Proxying request:', req.method, req.url, '→', proxyReq.path);
      },
      onProxyRes: (proxyRes, req, res) => {
        console.log('Proxy response:', proxyRes.statusCode, 'for', req.url);
      }
    })
  );
};