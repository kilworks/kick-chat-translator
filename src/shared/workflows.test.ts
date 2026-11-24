import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const release = readFileSync(join(process.cwd(), '.github/workflows/release.yml'), 'utf8');
const buildJob = release.slice(release.indexOf('\n  build:'), release.indexOf('\n  publish:'));

// A v* tag on any commit ships to both stores. The branch protection on master
// means nothing if a tag on an unreviewed branch can go around it.
describe('release workflow', () => {
  it('refuses a tag whose commit is not on master, before anything is built', () => {
    const gate = buildJob.indexOf('git merge-base --is-ancestor "$GITHUB_SHA" origin/master');
    expect(gate).toBeGreaterThan(-1);
    expect(buildJob).toContain('git fetch --no-tags origin master');
    expect(gate).toBeLessThan(buildJob.indexOf('npm run release:check'));
  });

  it('installs without running dependency scripts in the job that makes the published zips', () => {
    expect(buildJob).toContain('npm ci --ignore-scripts');
    expect(buildJob).not.toMatch(/npm ci\s*$/m);
  });

  it('keeps every action pinned by commit', () => {
    const uses = [...release.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/@[0-9a-f]{40}$/);
  });
});

// npx -y runs whatever the registry serves today with the maintainer's rights.
describe('.mcp.json', () => {
  it('runs a pinned package, never the latest', () => {
    const cfg = JSON.parse(readFileSync(join(process.cwd(), '.mcp.json'), 'utf8')) as {
      mcpServers: Record<string, { args: string[] }>;
    };
    for (const s of Object.values(cfg.mcpServers)) {
      const pkg = s.args.find((a) => a.startsWith('@') || /^[a-z]/.test(a) && a !== 'mcp');
      expect(pkg).toMatch(/@\d+\.\d+\.\d+$/);
    }
  });
});

// chrome.scripting.executeScript (compose.write) and the re-injection after an
// update need host access on every page the content script is injected into.
describe('manifest', () => {
  it('grants host access to every origin the content script matches', () => {
    const src = readFileSync(join(process.cwd(), 'manifest.config.ts'), 'utf8');
    const list = (re: RegExp): string[] => [...(re.exec(src)?.[1] ?? '').matchAll(/'(https:\/\/[^']+)'/g)].map((m) => m[1]!);
    const matches = list(/content_scripts:\s*\[\s*\{\s*matches:\s*\[([^\]]*)\]/);
    const hosts = list(/host_permissions:\s*\[([\s\S]*?)\]/);
    expect(matches.length).toBeGreaterThan(0);
    for (const m of matches) expect(hosts).toContain(m);
  });
});
