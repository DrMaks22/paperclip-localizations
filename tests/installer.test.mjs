import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const here = path.dirname(fileURLToPath(import.meta.url));
const runner = path.join(here, '..', 'apply.mjs');
const sha = (b) => createHash('sha256').update(b).digest('hex');
const cleanEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
const gitEnv = { ...cleanEnv, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull,
  GIT_AUTHOR_NAME: 'Synthetic Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Synthetic Test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_AUTHOR_DATE: '2026-09-07T00:00:00Z', GIT_COMMITTER_DATE: '2026-09-07T00:00:00Z' };
function git(repo, ...args) {
  const result = spawnSync('git', ['-C', repo, ...args], { env: gitEnv, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr); return result.stdout;
}
function write(root, relative, content) { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); }
function snapshot(root) {
  const files = [];
  function visit(dir) { for (const name of fs.readdirSync(dir).sort()) {
    const file = path.join(dir, name), stat = fs.lstatSync(file), relative = path.relative(root, file);
    if (stat.isDirectory()) visit(file);
    else files.push([relative, stat.mode & 0o777, stat.isSymbolicLink() ? `link:${fs.readlinkSync(file)}` : sha(fs.readFileSync(file))]);
  } }
  visit(root); return files;
}
function fixture(t) {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'paperclip-kit-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: false }));
  const repo = path.join(root, 'repo'), kit = path.join(root, 'kit');
  fs.mkdirSync(repo); fs.mkdirSync(kit); fs.copyFileSync(runner, path.join(kit, 'apply.mjs'));
  const baseFiles = { '.gitignore': 'ui/src/ignored.txt\n', 'ui/src/label.txt': 'Hello\n',
    'ui/src/old.txt': 'Remove this synthetic file\n', 'scripts/locale-changes.mjs': 'export const locale = "en";\n',
    'ui/src/mode.sh': '#!/bin/sh\n',
    'package.json': '{"name":"synthetic-patch-test"}\n', 'server/untouched.txt': 'Preserve server\n' };
  for (const [name, value] of Object.entries(baseFiles)) write(repo, name, value);
  git(repo, 'init', '--initial-branch=main'); git(repo, 'add', '.'); git(repo, 'commit', '-m', 'Synthetic base');
  const baseCommit = git(repo, 'rev-parse', 'HEAD').trim();
  write(repo, 'ui/src/label.txt', 'Привет\n'); write(repo, 'ui/src/new.txt', 'Русский\n');
  write(repo, 'scripts/locale-changes.mjs', 'export const locale = "ru";\n');
  fs.rmSync(path.join(repo, 'ui/src/old.txt'));
  git(repo, 'add', '-A');
  const patch = git(repo, 'diff', '--cached', '--no-ext-diff', '--no-textconv', '--no-renames', '--binary', 'HEAD');
  // Fixture setup only: restore its own synthetic index and files, without reset/checkout.
  git(repo, 'read-tree', 'HEAD');
  for (const [name, value] of Object.entries(baseFiles)) write(repo, name, value);
  fs.rmSync(path.join(repo, 'ui/src/new.txt'));
  const manifest = { schemaVersion: 1, ready: true, baseCommit, sourceCommit: baseCommit, patchFile: 'test.patch', patchSha256: sha(patch),
    allowedPaths: ['scripts/locale-changes.mjs', 'ui/src/label.txt', 'ui/src/new.txt', 'ui/src/old.txt'] };
  write(kit, 'test.patch', patch);
  const saveManifest = () => write(kit, 'manifest.json', JSON.stringify(manifest)); saveManifest();
  return { root, repo, kit, manifest, patch, saveManifest };
}
function run(f, args = [], extraEnv = {}) {
  return spawnSync(process.execPath, [path.join(f.kit, 'apply.mjs'), '--repo', f.repo, ...args], {
    encoding: 'utf8', env: { ...cleanEnv, ...extraEnv }, maxBuffer: 8 * 1024 * 1024, timeout: 60_000 });
}
function success(result) { assert.equal(result.status, 0, result.stderr); }
function refusal(f, args = [], pattern = /REFUSED:/) {
  const before = snapshot(f.repo), result = run(f, args);
  assert.notEqual(result.status, 0, result.stdout); assert.match(result.stderr, pattern);
  assert.deepEqual(snapshot(f.repo), before, 'refusal must preserve all checkout and .git bytes');
}
test('default check and explicit check leave all checkout and .git bytes unchanged', (t) => {
  const f = fixture(t), before = snapshot(f.repo); success(run(f)); success(run(f, ['--check']));
  assert.deepEqual(snapshot(f.repo), before);
});
test('apply, refuse reapply, reverse check, reverse apply restore exact baseline', (t) => {
  const f = fixture(t), before = snapshot(f.repo), gitBefore = snapshot(path.join(f.repo, '.git')); success(run(f, ['--apply']));
  assert.deepEqual(snapshot(path.join(f.repo, '.git')), gitBefore, 'forward apply must preserve HEAD, index, objects, refs, and config');
  assert.equal(fs.readFileSync(path.join(f.repo, 'ui/src/label.txt'), 'utf8'), 'Привет\n');
  assert.equal(fs.existsSync(path.join(f.repo, 'ui/src/old.txt')), false);
  refusal(f); refusal(f, ['--check']); refusal(f, ['--apply']); const applied = snapshot(f.repo); success(run(f, ['--reverse', '--check']));
  assert.deepEqual(snapshot(f.repo), applied); success(run(f, ['--reverse', '--apply']));
  assert.deepEqual(snapshot(f.repo), before); refusal(f, ['--reverse', '--apply']);
});
test('multi-megabyte patch completes check/apply/reverse without a large stdin pipe', (t) => {
  const f = fixture(t), before = snapshot(f.repo), lines = 120_000;
  const line = 'A synthetic localization string with enough bytes to exercise large patch input.\n';
  const content = line.repeat(lines);
  const large = f.patch + `diff --git a/ui/src/large.txt b/ui/src/large.txt\nnew file mode 100644\n--- /dev/null\n+++ b/ui/src/large.txt\n@@ -0,0 +1,${lines} @@\n` + ('+' + line).repeat(lines);
  assert.ok(Buffer.byteLength(large) > 9 * 1024 * 1024);
  write(f.kit, 'test.patch', large);
  f.manifest.patchSha256 = sha(large); f.manifest.allowedPaths.push('ui/src/large.txt'); f.saveManifest();
  success(run(f, ['--check'])); assert.deepEqual(snapshot(f.repo), before);
  success(run(f, ['--apply'])); assert.equal(fs.readFileSync(path.join(f.repo, 'ui/src/large.txt'), 'utf8'), content);
  const applied = snapshot(f.repo); success(run(f, ['--reverse', '--check'])); assert.deepEqual(snapshot(f.repo), applied);
  success(run(f, ['--reverse', '--apply'])); assert.deepEqual(snapshot(f.repo), before);
});
test('dirty tracked file is refused', (t) => { const f = fixture(t); write(f.repo, 'server/untouched.txt', 'User edit\n'); refusal(f, ['--apply']); });
test('dirty untracked file is refused', (t) => { const f = fixture(t); write(f.repo, 'user-note.txt', 'Preserve me\n'); refusal(f, ['--apply']); });
test('staged changes are refused', (t) => { const f = fixture(t); write(f.repo, 'server/untouched.txt', 'Staged\n'); git(f.repo, 'add', 'server/untouched.txt'); refusal(f, ['--apply']); });
test('reverse refuses an additional edit to a patch file', (t) => { const f = fixture(t); success(run(f, ['--apply'])); write(f.repo, 'ui/src/label.txt', 'User edit\n'); refusal(f, ['--reverse', '--apply']); });
test('reverse refuses an additional untracked file', (t) => { const f = fixture(t); success(run(f, ['--apply'])); write(f.repo, 'user-note.txt', 'Preserve\n'); refusal(f, ['--reverse', '--apply']); });
test('reverse refuses a user edit outside patch scope', (t) => { const f = fixture(t); success(run(f, ['--apply'])); write(f.repo, 'server/untouched.txt', 'Preserve\n'); refusal(f, ['--reverse', '--check']); });
test('wrong HEAD is refused', (t) => { const f = fixture(t); git(f.repo, 'commit', '--allow-empty', '-m', 'Unsupported version'); refusal(f, ['--apply'], /Unsupported revision/); });
test('wrong SHA-256 is refused', (t) => { const f = fixture(t); f.manifest.patchSha256 = 'a'.repeat(64); f.saveManifest(); refusal(f, ['--apply'], /SHA-256/); });
test('unfinalized example manifest is refused', (t) => { const f = fixture(t); f.manifest.ready = false; f.saveManifest(); refusal(f, ['--apply'], /not finalized/); });
test('unknown manifest schema is refused', (t) => { const f = fixture(t); f.manifest.schemaVersion = 2; f.saveManifest(); refusal(f, ['--apply']); });
test('manifest path outside UI and exact locale script scope is refused', (t) => { const f = fixture(t); f.manifest.allowedPaths.push('server/untouched.txt'); f.saveManifest(); refusal(f, ['--apply'], /allowedPaths/); });
test('patch paths must match manifest exactly', (t) => { const f = fixture(t); f.manifest.allowedPaths.pop(); f.saveManifest(); refusal(f, ['--apply'], /does not match/); });
test('path traversal in patch is refused', (t) => { const f = fixture(t); const malicious = f.patch.replaceAll('ui/src/label.txt', 'ui/../../escape.txt'); write(f.kit, 'test.patch', malicious); f.manifest.patchSha256 = sha(malicious); f.saveManifest(); refusal(f, ['--apply'], /forbidden path/); });
test('a .git path is refused', (t) => { const f = fixture(t); f.manifest.allowedPaths[0] = 'ui/.git/config'; f.saveManifest(); refusal(f, ['--apply']); });
test('symlink at a target file is refused and its external target is preserved', (t) => {
  const f = fixture(t), outside = path.join(f.root, 'outside.txt'); fs.writeFileSync(outside, 'Preserve outside\n');
  fs.rmSync(path.join(f.repo, 'ui/src/label.txt')); fs.symlinkSync(outside, path.join(f.repo, 'ui/src/label.txt'));
  refusal(f, ['--apply'], /Symbolic link/); assert.equal(fs.readFileSync(outside, 'utf8'), 'Preserve outside\n');
});
test('symlink directory in a target path is refused', (t) => {
  const f = fixture(t), outside = path.join(f.root, 'outside-ui'); fs.renameSync(path.join(f.repo, 'ui'), outside);
  fs.symlinkSync(outside, path.join(f.repo, 'ui')); const before = snapshot(outside); refusal(f, ['--apply'], /Symbolic link/); assert.deepEqual(snapshot(outside), before);
});
test('hard-linked target file is refused', (t) => { const f = fixture(t); fs.linkSync(path.join(f.repo, 'ui/src/label.txt'), path.join(f.root, 'hardlink.txt')); refusal(f, ['--apply'], /hard link/); });
test('symlink patch input is refused', (t) => { const f = fixture(t), actual = path.join(f.root, 'actual.patch'); fs.renameSync(path.join(f.kit, 'test.patch'), actual); fs.symlinkSync(actual, path.join(f.kit, 'test.patch')); refusal(f, ['--apply'], /regular file/); });
test('assume-unchanged flag cannot conceal user edits', (t) => { const f = fixture(t); git(f.repo, 'update-index', '--assume-unchanged', 'server/untouched.txt'); write(f.repo, 'server/untouched.txt', 'Hidden edit\n'); refusal(f, ['--apply'], /index flags/); });
test('ignored file colliding with a patch addition is refused', (t) => { const f = fixture(t); write(f.repo, 'ui/src/new.txt', 'Preserve ignored\n'); fs.appendFileSync(path.join(f.repo, '.git/info/exclude'), '\nui/src/new.txt\n'); refusal(f, ['--apply'], /already occupied/); });
test('unrelated ignored user config survives forward and reverse', (t) => {
  const f = fixture(t); write(f.repo, 'ui/src/ignored.txt', 'Private test config\n'); const before = snapshot(f.repo);
  success(run(f, ['--apply'])); success(run(f, ['--reverse', '--apply'])); assert.deepEqual(snapshot(f.repo), before);
});
test('conflicting operation flags are refused', (t) => { const f = fixture(t); refusal(f, ['--check', '--apply']); });
test('unknown flags are refused', (t) => { const f = fixture(t); refusal(f, ['--force']); });
test('GIT_DIR environment does not redirect the explicitly selected repo', (t) => {
  const f = fixture(t), before = snapshot(f.repo); success(run(f, ['--check'], { GIT_DIR: '/does/not/exist', GIT_WORK_TREE: '/does/not/exist' })); assert.deepEqual(snapshot(f.repo), before);
});
test('malformed hunk is refused by git apply check without changing checkout', (t) => {
  const f = fixture(t), bad = f.patch.replace('-Hello', '-Wrong base context');
  write(f.kit, 'test.patch', bad); f.manifest.patchSha256 = sha(bad); f.saveManifest(); refusal(f, ['--apply'], /Git apply/);
});
test('dirty executable mode is refused', (t) => { const f = fixture(t); fs.chmodSync(path.join(f.repo, 'ui/src/label.txt'), 0o755); refusal(f, ['--apply'], /Executable mode/); });
test('regular executable mode-only patch applies and reverses', (t) => {
  const f = fixture(t), before = snapshot(f.repo);
  const patch = f.patch + 'diff --git a/ui/src/mode.sh b/ui/src/mode.sh\nold mode 100644\nnew mode 100755\n';
  write(f.kit, 'test.patch', patch); f.manifest.patchSha256 = sha(patch); f.manifest.allowedPaths.push('ui/src/mode.sh'); f.saveManifest();
  success(run(f, ['--apply'])); assert.ok(fs.statSync(path.join(f.repo, 'ui/src/mode.sh')).mode & 0o111);
  success(run(f, ['--reverse', '--apply'])); assert.deepEqual(snapshot(f.repo), before);
});
test('symlink creation in patch is refused', (t) => {
  const f = fixture(t), patch = f.patch.replace('new file mode 100644', 'new file mode 120000');
  write(f.kit, 'test.patch', patch); f.manifest.patchSha256 = sha(patch); f.saveManifest(); refusal(f, ['--apply'], /Unsupported patch header/);
});
test('binary patch is refused', (t) => {
  const f = fixture(t), patch = 'diff --git a/ui/a.bin b/ui/a.bin\nnew file mode 100644\nindex 0000000..1111111\nGIT binary patch\nliteral 0\nHcmV?d00001\n';
  write(f.kit, 'test.patch', patch); f.manifest.patchSha256 = sha(patch); f.manifest.allowedPaths = ['ui/a.bin']; f.saveManifest(); refusal(f, ['--apply'], /Unsupported patch header/);
});
test('repo path must be explicit and absolute', (t) => {
  const f = fixture(t), before = snapshot(f.repo);
  for (const args of [[], ['--repo', 'repo']]) {
    const r = spawnSync(process.execPath, [path.join(f.kit, 'apply.mjs'), ...args], { encoding: 'utf8' });
    assert.notEqual(r.status, 0); assert.match(r.stderr, /Specify the repository explicitly/);
  }
  assert.deepEqual(snapshot(f.repo), before);
});
test('a subdirectory cannot be substituted for checkout root', (t) => {
  const f = fixture(t); f.repo = path.join(f.repo, 'ui'); refusal(f, ['--apply'], /checkout root/);
});
test('temporary files may not be created inside target checkout', (t) => {
  const f = fixture(t), before = snapshot(f.repo), r = run(f, ['--check'], { TMPDIR: f.repo, TMP: f.repo, TEMP: f.repo });
  assert.notEqual(r.status, 0); assert.match(r.stderr, /outside the target checkout/); assert.deepEqual(snapshot(f.repo), before);
});
test('external Git filters never run during checking or application', (t) => {
  const f = fixture(t), marker = path.join(f.root, 'filter-ran.txt'), script = path.join(f.root, 'filter.mjs');
  fs.writeFileSync(script, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'ran'); process.stdout.write(fs.readFileSync(0));`);
  const command = JSON.stringify(process.execPath) + ' ' + JSON.stringify(script);
  git(f.repo, 'config', 'filter.synthetic.clean', command);
  git(f.repo, 'config', 'filter.synthetic.smudge', command);
  write(f.repo, '.git/info/attributes', '* filter=synthetic\n');
  refusal(f, ['--check'], /filter/);
  refusal(f, ['--apply'], /filter/);
  assert.equal(fs.existsSync(marker), false, 'apply must not execute external filters');
});
test('partial clone configuration is refused without fetching objects', (t) => {
  const f = fixture(t); git(f.repo, 'config', 'remote.synthetic.promisor', 'true');
  refusal(f, ['--check'], /automatically fetch/); refusal(f, ['--apply'], /automatically fetch/);
});
test('scratch checks cannot inherit external filters from a temporary parent repository', (t) => {
  const f = fixture(t), marker = path.join(f.root, 'filter-ran.txt'), script = path.join(f.root, 'filter.mjs');
  fs.writeFileSync(script, `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'ran'); process.stdout.write(fs.readFileSync(0));`);
  git(f.root, 'init', '--initial-branch=main');
  git(f.root, 'config', 'filter.synthetic.clean', JSON.stringify(process.execPath) + ' ' + JSON.stringify(script));
  write(f.root, '.git/info/attributes', '* filter=synthetic\n');
  const before = snapshot(f.root);
  success(run(f, ['--check'], { TMPDIR: f.root, TMP: f.root, TEMP: f.root }));
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(fs.existsSync(marker), false);
});
test('help explains the public contract without reading the manifest or checkout', (t) => {
  const f = fixture(t), before = snapshot(f.repo);
  fs.rmSync(path.join(f.kit, 'manifest.json'));
  const result = spawnSync(process.execPath, [path.join(f.kit, 'apply.mjs'), '--help'], { encoding: 'utf8', env: cleanEnv });
  success(result);
  for (const expected of [/--repo \/absolute\/path/, /--check/, /--apply/, /--reverse --check/, /Node\.js 24\.x/, /before changing the upstream revision/]) assert.match(result.stdout, expected);
  assert.deepEqual(snapshot(f.repo), before);
});
test('package manifests and lockfiles are refused, including inside ui', (t) => {
  const f = fixture(t), paths = [...f.manifest.allowedPaths];
  for (const forbidden of ['package.json', 'pnpm-lock.yaml', 'ui/package.json', 'ui/package-lock.json', 'ui/npm-shrinkwrap.json', 'ui/pnpm-lock.yaml', 'ui/yarn.lock', 'ui/bun.lock', 'ui/bun.lockb', 'ui/nested/package.json']) {
    f.manifest.allowedPaths = [...paths, forbidden]; f.saveManifest();
    refusal(f, ['--apply'], /allowedPaths/);
  }
});
test('only the three exact locale scripts are allowed outside ui', (t) => {
  const f = fixture(t), paths = [...f.manifest.allowedPaths];
  for (const forbidden of ['scripts/locale-check.mjs', 'scripts/locale-changes-extra.mjs', 'scripts/locale-changes.mjs.bak', 'scripts/nested/locale-changes.mjs', 'scripts/install.mjs']) {
    f.manifest.allowedPaths = [...paths, forbidden]; f.saveManifest(); refusal(f, ['--apply'], /allowedPaths/);
  }
});
test('all three approved locale scripts can be applied and reversed', (t) => {
  const f = fixture(t), before = snapshot(f.repo);
  const additions = ['scripts/locale-changes.d.mts', 'scripts/sync-locales.mjs'];
  const patch = f.patch + additions.map((name) => `diff --git a/${name} b/${name}\nnew file mode 100644\n--- /dev/null\n+++ b/${name}\n@@ -0,0 +1 @@\n+export {};\n`).join('');
  write(f.kit, 'test.patch', patch); f.manifest.patchSha256 = sha(patch); f.manifest.allowedPaths.push(...additions); f.saveManifest();
  success(run(f, ['--apply'])); success(run(f, ['--reverse', '--apply'])); assert.deepEqual(snapshot(f.repo), before);
});
test('manifest rejects invalid commit identifiers and nonstring fields', (t) => {
  const f = fixture(t), original = { ...f.manifest };
  for (const [field, value] of [['baseCommit', 'HEAD'], ['baseCommit', f.manifest.baseCommit.slice(0, 12)], ['baseCommit', [f.manifest.baseCommit]], ['sourceCommit', null], ['sourceCommit', 'A'.repeat(40)], ['patchSha256', [f.manifest.patchSha256]], ['patchFile', ['test.patch']]]) {
    Object.assign(f.manifest, original, { [field]: value }); f.saveManifest(); refusal(f, ['--apply']);
  }
});
test('missing and malformed manifests fail without touching the target', (t) => {
  const f = fixture(t);
  for (const contents of ['null', '[]', '{}', '{broken']) {
    write(f.kit, 'manifest.json', contents); refusal(f, ['--apply']);
  }
  fs.rmSync(path.join(f.kit, 'manifest.json')); refusal(f, ['--apply'], /file not found/);
});
test('manifest refuses duplicate and unsafe allowedPaths', (t) => {
  const f = fixture(t), paths = [...f.manifest.allowedPaths];
  for (const forbidden of [paths[0], '/ui/file.txt', 'ui/../file.txt', 'ui//file.txt', 'ui/./file.txt', 'ui/.GIT/config', 'ui/file:stream', 'ui/back\\slash', 'ui/control\0.txt', 'ui/space name.txt', '', null]) {
    f.manifest.allowedPaths = [...paths, forbidden]; f.saveManifest(); refusal(f, ['--apply'], /allowedPaths/);
  }
});
test('patch filename cannot escape the release directory', (t) => {
  const f = fixture(t);
  for (const name of ['../test.patch', '/tmp/test.patch', 'dir/test.patch', '.patch', 'test.patch\0', 'test\\patch.patch']) {
    f.manifest.patchFile = name; f.saveManifest(); refusal(f, ['--apply'], /patchFile/);
  }
});
test('hard-linked patch and manifest inputs are refused', (t) => {
  const f = fixture(t);
  fs.linkSync(path.join(f.kit, 'test.patch'), path.join(f.root, 'patch-link'));
  refusal(f, ['--apply'], /regular file/);
  fs.unlinkSync(path.join(f.root, 'patch-link'));
  fs.linkSync(path.join(f.kit, 'manifest.json'), path.join(f.root, 'manifest-link'));
  refusal(f, ['--apply'], /regular file/);
});
test('symlink manifest input is refused', (t) => {
  const f = fixture(t), actual = path.join(f.root, 'actual-manifest.json');
  fs.renameSync(path.join(f.kit, 'manifest.json'), actual); fs.symlinkSync(actual, path.join(f.kit, 'manifest.json'));
  refusal(f, ['--apply'], /regular file/);
});
test('hard links outside patch scope are refused', (t) => {
  const f = fixture(t); fs.linkSync(path.join(f.repo, 'server/untouched.txt'), path.join(f.root, 'server-link'));
  refusal(f, ['--apply'], /hard link/);
});
test('a partial patch is refused in both directions', (t) => {
  const f = fixture(t); write(f.repo, 'ui/src/label.txt', 'Привет\n');
  refusal(f, ['--apply']); refusal(f, ['--reverse', '--check']); refusal(f, ['--reverse', '--apply']);
});
test('a complete patch with staged changes is refused on reverse', (t) => {
  const f = fixture(t); success(run(f, ['--apply'])); git(f.repo, 'add', 'ui/src/label.txt');
  refusal(f, ['--reverse', '--apply'], /index differs/);
});
test('skip-worktree flags cannot conceal unrelated edits', (t) => {
  const f = fixture(t); git(f.repo, 'update-index', '--skip-worktree', 'server/untouched.txt');
  write(f.repo, 'server/untouched.txt', 'Hidden edit\n'); refusal(f, ['--apply'], /index flags/);
});
test('duplicate patch sections and renames are refused', (t) => {
  const f = fixture(t);
  for (const patch of [f.patch + f.patch, f.patch.replace('b/ui/src/label.txt', 'b/ui/src/renamed.txt')]) {
    write(f.kit, 'test.patch', patch); f.manifest.patchSha256 = sha(patch); f.saveManifest(); refusal(f, ['--apply']);
  }
});
test('repeated and incomplete CLI flags are refused', (t) => {
  const f = fixture(t);
  for (const args of [['--apply', '--apply'], ['--check', '--check'], ['--reverse', '--reverse'], ['--repo'], ['--help'], ['--repo', f.repo]]) refusal(f, args, /argument/);
});
test('configured fsmonitor and injected Git environment never execute helpers', (t) => {
  const f = fixture(t), marker = path.join(f.root, 'helper-ran.txt'), script = path.join(f.root, 'helper.mjs');
  write(f.root, 'helper.mjs', `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'ran');`);
  git(f.repo, 'config', 'core.fsmonitor', JSON.stringify(process.execPath) + ' ' + JSON.stringify(script));
  const before = snapshot(f.repo);
  success(run(f, ['--check'], { GIT_CONFIG_COUNT: '1', GIT_CONFIG_KEY_0: 'core.fsmonitor', GIT_CONFIG_VALUE_0: script, GIT_INDEX_FILE: path.join(f.root, 'fake-index'), GIT_OBJECT_DIRECTORY: path.join(f.root, 'fake-objects') }));
  assert.deepEqual(snapshot(f.repo), before); assert.equal(fs.existsSync(marker), false);
});
test('filters from included repository config are refused without execution', (t) => {
  const f = fixture(t), marker = path.join(f.root, 'filter-ran.txt'), script = path.join(f.root, 'filter.mjs');
  write(f.root, 'filter.mjs', `import fs from 'node:fs'; fs.writeFileSync(${JSON.stringify(marker)}, 'ran');`);
  const included = path.join(f.root, 'included.config');
  git(f.repo, 'config', '--file', included, 'filter.synthetic.process', JSON.stringify(process.execPath) + ' ' + JSON.stringify(script));
  git(f.repo, 'config', 'include.path', included);
  refusal(f, ['--apply'], /filter/); assert.equal(fs.existsSync(marker), false);
});
test('extensions.partialClone is refused without contacting the remote', (t) => {
  const f = fixture(t); git(f.repo, 'config', 'extensions.partialClone', 'origin');
  git(f.repo, 'config', 'remote.origin.url', 'https://example.invalid/never-fetch.git');
  refusal(f, ['--check'], /automatically fetch/);
});
