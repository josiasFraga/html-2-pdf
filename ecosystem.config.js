module.exports = {
  apps: [
    {
      name: 'html2pdf',
      script: 'dist/main.js',
      env: {
        NODE_ENV: 'production',
        CHROME_PATH: '/tmp/chromium'      // ← caminho exibido pelo comando
      }
    }
  ]
}
