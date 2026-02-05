const { app } = require('electron');

console.log('App object:', app);
console.log('App typeof:', typeof app);

app.on('ready', () => {
  console.log('App is ready!');
  app.quit();
});
