const { app, BrowserWindow } = require('electron');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      offscreen: true
    }
  });

  win.webContents.on('console-message', (e, level, msg) => {
    console.log('[BROWSER CONSOLE]', msg);
  });

  console.log('Loading http://localhost:5173/ ...');
  await win.loadURL('http://localhost:5173/');
  console.log('Current URL after load:', win.webContents.getURL());

  // Wait 4.5 seconds for any splash screen or animation to complete
  await new Promise((r) => setTimeout(r, 4500));
  console.log('Current URL after 4.5s:', win.webContents.getURL());

  const img = await win.capturePage();
  fs.writeFileSync('screenshot-web.png', img.toPNG());
  console.log('SCREENSHOT_SAVED to screenshot-web.png');
  app.quit();
});
