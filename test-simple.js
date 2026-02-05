const electron = require('electron');
console.log('Electron API:', typeof electron, electron.app ? 'has app' : 'no app');
if (electron.app) {
  electron.app.whenReady().then(() => {
    console.log('App is ready!');
    electron.app.quit();
  });
}
