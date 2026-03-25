/**
 * Preload script — exposes safe IPC bridge to renderer.
 */

import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("spectyra", {
  companion: {
    start: () => ipcRenderer.invoke("companion:start"),
    stop: () => ipcRenderer.invoke("companion:stop"),
    status: () => ipcRenderer.invoke("companion:status"),
    health: () => ipcRenderer.invoke("companion:health"),
  },
  onLog: (cb: (msg: string) => void) => {
    ipcRenderer.on("companion-log", (_e, msg) => cb(msg));
  },
  onStatus: (cb: (status: { running: boolean; code?: number }) => void) => {
    ipcRenderer.on("companion-status", (_e, s) => cb(s));
  },
});
