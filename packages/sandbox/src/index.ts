export { isDockerAvailable } from "./image";

export interface SandboxResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export async function runInSandbox(
  _command: string,
  _cwd: string,
): Promise<SandboxResult> {
  throw new Error("not implemented");
}