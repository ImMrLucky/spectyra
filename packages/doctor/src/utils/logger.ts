import pc from "picocolors";

export const log = {
  info: (msg: string) => console.log(pc.cyan(msg)),
  ok: (msg: string) => console.log(pc.green(msg)),
  warn: (msg: string) => console.warn(pc.yellow(msg)),
  err: (msg: string) => console.error(pc.red(msg)),
  dim: (msg: string) => console.log(pc.dim(msg)),
};
