// Ember for Windows - a native window around your Ember app.
// It loads the published app, so it updates itself; the app's offline cache keeps it working without internet.
const { app, BrowserWindow, shell, nativeTheme, session } = require('electron');
const path = require('path');
const fs = require('fs');

const APP_URL = 'https://flare0805.github.io/ember/';

app.setAppUserModelId('com.flare0805.ember'); // needed for Windows notifications (focus timer)
if (!app.requestSingleInstanceLock()) app.quit();
nativeTheme.themeSource = 'dark'; // dark Windows title bar

const stateFile = () => path.join(app.getPath('userData'), 'window.json');
const readState = () => {
  try {
    return JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
  } catch (e) {
    return {};
  }
};

let win;

function createWindow() {
  const st = readState();
  win = new BrowserWindow({
    width: st.width || 1320,
    height: st.height || 860,
    x: st.x,
    y: st.y,
    minWidth: 380,
    minHeight: 560,
    title: 'Ember',
    backgroundColor: '#161618',
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, spellcheck: true },
  });
  win.removeMenu();
  if (st.maximized) win.maximize();
  win.webContents.setUserAgent(`${win.webContents.getUserAgent()} EmberDesktop/${app.getVersion()}`);
  win.once('ready-to-show', () => win.show());

  // Links to other sites (Open Library, GitHub…) open in your normal browser
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(APP_URL) && !url.startsWith('file:')) {
      e.preventDefault();
      shell.openExternal(url);
    }
  });

  // First start without internet: show a friendly screen instead of an error
  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (isMainFrame && code !== -3) win.loadFile(path.join(__dirname, 'offline.html'));
  });

  // F5 reload, Ctrl+Shift+R reload without cache, Ctrl +/- zoom, Ctrl 0 reset zoom
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    const wc = win.webContents, ctrl = input.control || input.meta;
    if (input.key === 'F5' || (ctrl && input.key.toLowerCase() === 'r')) {
      e.preventDefault();
      input.shift ? wc.reloadIgnoringCache() : wc.reload();
    } else if (ctrl && (input.key === '=' || input.key === '+')) {
      e.preventDefault();
      wc.setZoomLevel(Math.min(wc.getZoomLevel() + 0.5, 3));
    } else if (ctrl && input.key === '-') {
      e.preventDefault();
      wc.setZoomLevel(Math.max(wc.getZoomLevel() - 0.5, -3));
    } else if (ctrl && input.key === '0') {
      e.preventDefault();
      wc.setZoomLevel(0);
    }
  });

  win.on('close', () => {
    try {
      fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() }));
    } catch (e) { /* not critical */ }
  });
  win.on('closed', () => (win = null));

  win.loadURL(APP_URL);
}

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(() => {
  // Allow notifications (focus timer) and clipboard (copy journal text); nothing else is granted
  session.defaultSession.setPermissionRequestHandler((wc, permission, cb) => cb(['notifications', 'clipboard-sanitized-write'].includes(permission)));
  createWindow();
});

app.on('window-all-closed', () => app.quit());
