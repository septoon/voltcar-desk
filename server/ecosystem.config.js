module.exports = {
  apps: [
    {
      name: "voltcar-crm-api",
      script: "dist/index.js",
      cwd: "/var/www/voltcar-desk/server",
      env: {
        NODE_ENV: "production",
        PUPPETEER_EXECUTABLE_PATH: "/home/deploy/.cache/puppeteer/chrome/linux-143.0.7499.169/chrome-linux64/chrome"
      }
    }
  ]
};
