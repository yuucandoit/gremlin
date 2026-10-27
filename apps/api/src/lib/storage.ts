import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

function getWorkspaceRoot(): string {
  let curr = import.meta.dir;
  while (curr !== '/' && dirname(curr) !== curr) {
    if (existsSync(join(curr, 'apps')) && existsSync(join(curr, 'packages'))) {
      return curr;
    }
    curr = dirname(curr);
  }
  return process.cwd();
}

const root = getWorkspaceRoot();
const DATA_ROOT = process.env.DATA_DIR
  ? resolve(process.cwd(), process.env.DATA_DIR)
  : join(root, 'data');

export const storage = {
  getRoot(): string {
    return DATA_ROOT;
  },

  getRunDir(runId: string): string {
    const dir = join(DATA_ROOT, 'runs', runId);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  },

  getStepsDir(runId: string): string {
    const dir = join(this.getRunDir(runId), 'steps');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    return dir;
  },

  getStepScreenshotPath(runId: string, stepNumber: number): string {
    const padded = String(stepNumber).padStart(3, '0');
    return join(this.getStepsDir(runId), `${padded}.png`);
  },

  getStepScreenshotRelative(runId: string, stepNumber: number): string {
    const padded = String(stepNumber).padStart(3, '0');
    return `steps/${padded}.png`;
  },

  getRegressionSpecPath(runId: string): string {
    return join(this.getRunDir(runId), 'regression.spec.ts');
  },

  getTracePath(runId: string): string {
    return join(this.getRunDir(runId), 'trace.zip');
  },

  saveRegressionSpec(runId: string, content: string): string {
    const filePath = this.getRegressionSpecPath(runId);
    writeFileSync(filePath, content, 'utf-8');
    return filePath;
  },

  getPublicArtifactUrl(runId: string, relativePath: string): string {
    return `/runs/${runId}/artifacts/${relativePath}`;
  },

  deleteRunDir(runId: string): void {
    const dir = join(DATA_ROOT, 'runs', runId);
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  },

  clearAllRunsDir(): void {
    const runsDir = join(DATA_ROOT, 'runs');
    if (existsSync(runsDir)) {
      rmSync(runsDir, { recursive: true, force: true });
      mkdirSync(runsDir, { recursive: true });
    }
  },
};
