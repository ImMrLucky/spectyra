/**
 * Spectyra Desktop App — Electron main process.
 *
 * Responsibilities:
 * - Start/stop the Local Companion process
 * - Serve the local dashboard UI
 * - Onboarding wizard
 * - Provider key management (session-only by default)
 * - License activation
 */

import { app, BrowserWindow, ipcMain } from "electron";
import path from "path";
import { spawn, type ChildProcess } from "child_process";

let mainWindow: BrowserWindow | null = null;
let companionProcess: ChildProcess | null = null;

const COMPANION_PORT = 4111;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    title: "Spectyra",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "..", "ui", "index.html"));
  mainWindow.on("closed", () => { mainWindow = null; });
}

function startCompanion(): void {
  if (companionProcess) return;

  const companionPath = path.resolve(
    __dirname, "..", "..", "..", "tools", "local-companion", "src", "companion.ts",
  );

  companionProcess = spawn("npx", ["tsx", companionPath], {
    env: {
      ...process.env,
      SPECTYRA_PORT: String(COMPANION_PORT),
      SPECTYRA_BIND_HOST: "127.0.0.1",
    },
    stdio: "pipe",
  });

  companionProcess.stdout?.on("data", (d) => {
    mainWindow?.webContents.send("companion-log", d.toString());
  });
  companionProcess.stderr?.on("data", (d) => {
    mainWindow?.webContents.send("companion-log", d.toString());
  });
  companionProcess.on("exit", (code) => {
    companionProcess = null;
    mainWindow?.webContents.send("companion-status", { running: false, code });
  });
}

function stopCompanion(): void {
  companionProcess?.kill();
  companionProcess = null;
}

// IPC handlers
ipcMain.handle("companion:start", () => { startCompanion(); return true; });
ipcMain.handle("companion:stop", () => { stopCompanion(); return true; });
ipcMain.handle("companion:status", () => ({ running: !!companionProcess, port: COMPANION_PORT }));
ipcMain.handle("companion:health", async () => {
  try {
    const res = await fetch(`http://127.0.0.1:${COMPANION_PORT}/health`);
    return await res.json();
  } catch {
    return null;
  }
});

app.whenReady().then(() => {
  createWindow();
  startCompanion();
});

app.on("window-all-closed", () => {
  stopCompanion();
  app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
