const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const { spawn, exec } = require('child_process');

// 启动另一个应用
let child = null;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../public/favicon.png'),
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  // 加载构建后的应用
  mainWindow.loadURL(url.format({
    pathname: path.join(__dirname, '../dist/index.html'),
    protocol: 'file:',
    slashes: true
  }));

  // 打开开发者工具
  // mainWindow.webContents.openDevTools();
}

function killProcessTree(pid) {
  if (process.platform === 'win32') {
    // Windows: 使用 taskkill 命令杀死整个进程树
    exec(`taskkill /F /T /PID ${pid}`, (error) => {
      if (error) {
        console.error('Failed to kill process tree:', error);
      } else {
        console.log('Process tree killed successfully');
      }
    });
  } else {
    // 其他平台: 使用 kill 命令
    exec(`kill -9 ${pid}`, (error) => {
      if (error) {
        console.error('Failed to kill process tree:', error);
      } else {
        console.log('Process tree killed successfully');
      }
    });
  }
}

app.whenReady().then(() => {
  // 启动后端应用
  const backendPath = path.join(process.resourcesPath, 'app.exe');
  console.log('Starting backend from:', backendPath);
  child = spawn(backendPath, []);
  
  createWindow();

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 在主应用关闭时关闭子应用
app.on('window-all-closed', () => {
  if (child) {
    console.log('Killing backend process tree...');
    killProcessTree(child.pid);
    child = null;
  }
  if (process.platform !== 'darwin') app.quit();
});

app.on('quit', function () {
  if (child) {
    console.log('Killing backend process tree on quit...');
    killProcessTree(child.pid);
    child = null;
  }
});
