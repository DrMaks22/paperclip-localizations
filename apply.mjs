#!/usr/bin/env node
// Dependency-free, fail-closed patch application for one reviewed Git snapshot.
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = path.dirname(fileURLToPath(import.meta.url));
const MAX_BUFFER = 256 * 1024 * 1024;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
Object.assign(env, { GIT_OPTIONAL_LOCKS: '0', GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: os.devNull, GIT_NO_REPLACE_OBJECTS: '1', GIT_NO_LAZY_FETCH: '1', GIT_ATTR_NOSYSTEM: '1' });
const gitOptions = ['-c', 'core.fsmonitor=false', '-c', 'core.untrackedCache=false', '-c', 'core.hooksPath=' + os.devNull, '-c', 'core.attributesFile=' + os.devNull];
const fail = (message) => { throw new Error(message); };
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const blobHash = (bytes) => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
function git(cwd, args, input) {
  // A --no-index scratch operation must not discover a different parent repository.
  const commandEnv = args.includes('--no-index') ? { ...env, GIT_CEILING_DIRECTORIES: path.dirname(cwd) } : env;
  let inputDirectory, inputFd, result;
  try {
    if (input !== undefined) {
      // A regular stdin file avoids a large synchronous pipe stalling before EOF.
      // Copy the already verified bytes; never reopen a caller-controlled patch path.
      const temporaryRoot = fs.realpathSync(os.tmpdir());
      if (temporaryRoot === cwd || temporaryRoot.startsWith(cwd + path.sep)) fail('The temporary directory must be outside the target checkout.');
      inputDirectory = fs.mkdtempSync(path.join(temporaryRoot, 'paperclip-localizations-input-'));
      const inputPath = path.join(inputDirectory, 'verified.patch');
      fs.writeFileSync(inputPath, input, { flag: 'wx', mode: 0o600 });
      inputFd = fs.openSync(inputPath, 'r');
    }
    result = spawnSync('git', [...gitOptions, '-C', cwd, ...args], {
      env: commandEnv, stdio: [inputFd ?? 'ignore', 'pipe', 'pipe'],
      encoding: null, maxBuffer: MAX_BUFFER, timeout: 60_000,
    });
  } finally {
    if (inputFd !== undefined) fs.closeSync(inputFd);
    if (inputDirectory) fs.rmSync(inputDirectory, { recursive: true, force: false });
  }
  if (result.error) fail(`Could not run Git: ${result.error.message}`);
  if (result.status !== 0) fail(`Git ${args[0]}: ${result.stderr.toString('utf8').trim() || (result.signal ? `signal ${result.signal}` : `exit code ${result.status}`)}`);
  return result.stdout;
}
function regularFile(file, label) {
  let stat;
  try { stat = fs.lstatSync(file); } catch { fail(`${label}: file not found.`); }
  if (!stat.isFile() || stat.nlink !== 1) fail(`${label}: a regular file without symbolic or hard links is required.`);
  return fs.readFileSync(file);
}
function relativePath(value) {
  return typeof value === 'string' && value.length > 0 && !path.posix.isAbsolute(value)
    && !value.includes('\\') && !value.includes('\0') && !value.includes(':')
    && value.split('/').every((part) => part !== '' && part !== '.' && part !== '..' && part.toLowerCase() !== '.git');
}
function permitted(value) {
  if (!relativePath(value) || !/^[A-Za-z0-9_.@+/-]+$/.test(value)) return false;
  if (['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lock', 'bun.lockb', 'pnpm-workspace.yaml'].includes(path.posix.basename(value).toLowerCase())) return false;
  return value.startsWith('ui/') || ['scripts/locale-changes.d.mts', 'scripts/locale-changes.mjs', 'scripts/sync-locales.mjs'].includes(value);
}
function inspectPath(root, relative, { allowLeafSymlink = false } = {}) {
  if (!relativePath(relative)) fail(`Unsafe path: ${JSON.stringify(relative)}`);
  const parts = relative.split('/');
  let current = root;
  for (let i = 0; i < parts.length; i++) {
    current = path.join(current, parts[i]);
    let stat;
    try { stat = fs.lstatSync(current); } catch (error) { if (error.code === 'ENOENT') return null; throw error; }
    const leaf = i === parts.length - 1;
    if (stat.isSymbolicLink() && !(leaf && allowLeafSymlink)) fail(`Symbolic link in path: ${relative}`);
    if (!leaf && !stat.isDirectory()) fail(`Path component is not a directory: ${relative}`);
    if (leaf) return stat;
  }
}
function parseTree(bytes, index = false) {
  const result = new Map();
  for (const record of bytes.toString('utf8').split('\0').filter(Boolean)) {
    const match = index ? /^(\d{6}) ([0-9a-f]{40}) (\d)\t([\s\S]+)$/.exec(record)
      : /^(\d{6}) (blob|commit) ([0-9a-f]{40})\t([\s\S]+)$/.exec(record);
    if (!match) fail('Unrecognized Git tree or index format.');
    if (index && match[3] !== '0') fail('The index contains an unresolved conflict.');
    const mode = match[1], hash = index ? match[2] : match[3], name = match[4];
    if (!relativePath(name) || result.has(name)) fail('Unsafe or duplicate path in the Git tree.');
    if (!['100644', '100755', '120000'].includes(mode)) fail('Repositories with submodules or special files are not supported.');
    result.set(name, { mode, hash });
  }
  return result;
}
function parsePatch(bytes) {
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  if (!text.startsWith('diff --git ') || text.includes('\0')) fail('A plain text Git diff without an email preamble is required.');
  const sections = text.split(/^diff --git /m).slice(1);
  const files = new Map();
  for (const section of sections) {
    const lines = section.split('\n');
    const first = /^a\/([^ ]+) b\/([^ ]+)$/.exec(lines.shift());
    if (!first || first[1] !== first[2] || !permitted(first[1])) fail('The patch contains a forbidden path, rename, or unsupported filename.');
    const name = first[1];
    if (files.has(name)) fail(`Duplicate file in patch: ${name}`);
    const item = { name, operation: 'modify', mode: null };
    for (const line of lines) {
      if (line.startsWith('@@ ')) break;
      if (line === '') continue;
      let match;
      if ((match = /^(new file mode|deleted file mode|old mode|new mode) (100644|100755)$/.exec(line))) {
        if (match[1] === 'new file mode') item.operation = 'add';
        if (match[1] === 'deleted file mode') item.operation = 'delete';
        if (match[1] === 'new file mode' || match[1] === 'new mode') item.mode = match[2];
        continue;
      }
      if (/^index [0-9a-f]+\.\.[0-9a-f]+(?: 100(?:644|755))?$/.test(line)) continue;
      if (line === `--- a/${name}` || line === `+++ b/${name}` || line === '--- /dev/null' || line === '+++ /dev/null') continue;
      fail(`Unsupported patch header for ${name}: ${line.slice(0, 100)}`);
    }
    files.set(name, item);
  }
  if (!files.size) fail('The patch is empty.');
  return files;
}
function sameEntries(a, b) {
  return a.size === b.size && [...a].every(([name, value]) => b.get(name)?.hash === value.hash && b.get(name)?.mode === value.mode);
}
function checkGitConfiguration(repo) {
  for (const record of git(repo, ['config', '--null', '--list', '--includes']).toString('utf8').split('\0').filter(Boolean)) {
    const separator = record.indexOf('\n');
    const key = (separator < 0 ? record : record.slice(0, separator)).toLowerCase();
    const value = separator < 0 ? '' : record.slice(separator + 1);
    if (/^filter\..*\.(?:clean|smudge|process)$/.test(key) && value.trim()) fail('An external Git filter is configured. Use a separate checkout without executable filters.');
    if (key === 'extensions.partialclone' || /^remote\..*\.promisor$/.test(key)) fail('Partial clones that may automatically fetch objects are not supported.');
  }
}
function checkState(repo, baseTree, expectedTree) {
  const index = parseTree(git(repo, ['ls-files', '--stage', '-z']), true);
  if (!sameEntries(baseTree, index)) fail('The index differs from the base commit. Save your changes separately.');
  for (const entry of git(repo, ['ls-files', '-v', '-z']).toString('utf8').split('\0').filter(Boolean)) {
    if (entry[0] !== 'H') fail('Unsupported index flags (such as assume-unchanged or skip-worktree).');
  }
  const allNames = new Set([...baseTree.keys(), ...expectedTree.keys()]);
  for (const name of allNames) {
    const expected = expectedTree.get(name);
    const stat = inspectPath(repo, name, { allowLeafSymlink: expected?.mode === '120000' && baseTree.get(name)?.mode === '120000' });
    if (!expected) { if (stat) fail(`Unexpected file or user changes: ${name}`); continue; }
    if (!stat) fail(`Expected file is missing: ${name}`);
    let bytes;
    if (expected.mode === '120000') {
      if (!stat.isSymbolicLink()) fail(`File type has changed: ${name}`);
      bytes = Buffer.from(fs.readlinkSync(path.join(repo, name)));
    } else {
      if (!stat.isFile() || stat.nlink !== 1) fail(`Unsafe file type or hard link: ${name}`);
      const executable = (stat.mode & 0o111) !== 0;
      if (executable !== (expected.mode === '100755')) fail(`Executable mode has changed: ${name}`);
      bytes = fs.readFileSync(path.join(repo, name));
    }
    if (blobHash(bytes) !== expected.hash) fail(`User changes or incompatible line endings: ${name}`);
  }
  for (const name of git(repo, ['ls-files', '--others', '--exclude-standard', '-z']).toString('utf8').split('\0').filter(Boolean)) {
    if (!expectedTree.has(name) || baseTree.has(name)) fail(`Untracked file: ${JSON.stringify(name)}`);
  }
}
function expectedPatchedTree(repo, baseTree, files, patch) {
  // The scratch directory is outside the checkout. No index/object writes in the target repo.
  const temporaryRoot = fs.realpathSync(os.tmpdir());
  if (temporaryRoot === repo || temporaryRoot.startsWith(repo + path.sep)) fail('The temporary directory must be outside the target checkout.');
  const scratch = fs.mkdtempSync(path.join(temporaryRoot, 'paperclip-localizations-preview-'));
  try {
    const expected = new Map(baseTree);
    for (const [name, item] of files) {
      const base = baseTree.get(name);
      if (item.operation === 'add' ? !!base : !base) fail(`Patch operation does not match the base tree: ${name}`);
      if (base?.mode === '120000') fail(`The patch must not modify symbolic links: ${name}`);
      if (base) {
        const target = path.join(scratch, name);
        fs.mkdirSync(path.dirname(target), { recursive: true });
        fs.writeFileSync(target, git(repo, ['cat-file', 'blob', base.hash]));
        fs.chmodSync(target, base.mode === '100755' ? 0o755 : 0o644);
      }
    }
    const stat = git(scratch, ['apply', '--no-index', '--numstat', '-z', '-'], patch).toString('utf8').split('\0').filter(Boolean);
    const statNames = stat.map((record) => {
      const match = /^\d+\t\d+\t([^\t]+)$/.exec(record);
      if (!match) fail('Binary patch, rename, or unrecognized numstat format.');
      return match[1];
    });
    if (statNames.length !== files.size || statNames.some((name) => !files.has(name)) || new Set(statNames).size !== files.size) fail('Paths in patch headers and Git output do not match.');
    git(scratch, ['apply', '--no-index', '--check', '--whitespace=nowarn', '-'], patch);
    git(scratch, ['apply', '--no-index', '--whitespace=nowarn', '-'], patch);
    for (const [name, item] of files) {
      const stat = inspectPath(scratch, name);
      if (item.operation === 'delete') { if (stat) fail(`The patch did not delete the expected file: ${name}`); expected.delete(name); continue; }
      if (!stat?.isFile()) fail(`Expected patch result is missing: ${name}`);
      const mode = (stat.mode & 0o111) ? '100755' : '100644';
      expected.set(name, { mode, hash: blobHash(fs.readFileSync(path.join(scratch, name))) });
    }
    return expected;
  } finally {
    // Exact directory returned by mkdtemp, never a user-provided cleanup target.
    fs.rmSync(scratch, { recursive: true, force: false });
  }
}
function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log(`Paperclip Localizations — offline patch installer

Usage: node apply.mjs --repo /absolute/path/to/paperclip [--check | --apply] [--reverse]

  --repo PATH  Explicit absolute path to the Paperclip checkout root.
  --check      Validate only; this is the default. The target stays unchanged.
  --apply      Apply the verified patch to working files only.
  --reverse    Check or apply the reverse patch using this same release kit.
  --help       Show these instructions.

Requires Node.js 24.x, Git, and the exact baseCommit in manifest.json.
Forward operations require a clean baseline; an already applied or partial
patch is refused. To verify an installed patch, use --reverse --check.
Reverse requires the complete original patch with no additional user edits.
Staged changes, unrelated tracked edits, and nonignored untracked files are
refused. Unrelated ignored files are preserved.

Check first, apply explicitly, then follow the project's validation instructions.
Reverse with this same kit before changing the upstream revision. The installer
never installs dependencies, fetches objects, restarts services, commits changes,
or changes Git HEAD or the index. Do not edit or update the checkout concurrently.`);
    return;
  }
  if (Number(process.versions.node.split('.')[0]) !== 24) fail('Node.js 24.x is required. Other versions have not been validated for this release.');
  let repoArg, apply = false, reverse = false, check = false;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--repo' && !repoArg && args[i + 1] && !args[i + 1].startsWith('--')) repoArg = args[++i];
    else if (arg === '--apply' && !apply) apply = true;
    else if (arg === '--check' && !check) check = true;
    else if (arg === '--reverse' && !reverse) reverse = true;
    else fail(`Unknown, repeated, or incomplete argument: ${arg}`);
  }
  if (!repoArg || !path.isAbsolute(repoArg)) fail('Specify the repository explicitly: --repo /absolute/path.');
  if (apply && check) fail('Choose only one mode: --check or --apply.');
  const manifest = JSON.parse(regularFile(path.join(KIT, 'manifest.json'), 'Manifest').toString('utf8'));
  if (!manifest || manifest.schemaVersion !== 1 || manifest.ready !== true) fail('The manifest is not finalized or its schema is unknown. This release cannot be applied.');
  if (['baseCommit', 'sourceCommit'].some((key) => typeof manifest[key] !== 'string' || !/^[0-9a-f]{40}$/.test(manifest[key]))
    || typeof manifest.patchSha256 !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.patchSha256)) fail('The manifest requires valid baseCommit, sourceCommit, and patchSha256 values.');
  if (typeof manifest.patchFile !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*\.patch$/.test(manifest.patchFile)) fail('Unsafe patchFile name in the manifest.');
  if (!Array.isArray(manifest.allowedPaths) || !manifest.allowedPaths.length || manifest.allowedPaths.some((name) => !permitted(name)) || new Set(manifest.allowedPaths).size !== manifest.allowedPaths.length) fail('The manifest requires a valid, exact allowedPaths list.');
  const patch = regularFile(path.join(KIT, manifest.patchFile), 'Patch');
  if (patch.length > MAX_BUFFER) fail('The patch exceeds the supported size limit.');
  if (sha256(patch) !== manifest.patchSha256) fail('The patch SHA-256 does not match the manifest.');
  const files = parsePatch(patch);
  if (JSON.stringify([...files.keys()].sort()) !== JSON.stringify([...manifest.allowedPaths].sort())) fail('The patch path list does not match allowedPaths.');
  const repo = fs.realpathSync(repoArg);
  if (git(repo, ['rev-parse', '--is-inside-work-tree']).toString().trim() !== 'true') fail('A Git working checkout is required.');
  if (fs.realpathSync(git(repo, ['rev-parse', '--show-toplevel']).toString().trim()) !== repo) fail('--repo must point to the checkout root.');
  checkGitConfiguration(repo);
  const head = () => git(repo, ['rev-parse', 'HEAD']).toString().trim();
  if (head() !== manifest.baseCommit) fail(`Unsupported revision. HEAD must be exactly ${manifest.baseCommit}.`);
  if (git(repo, ['rev-parse', '--show-object-format']).toString().trim() !== 'sha1') fail('Only the original SHA-1 Git object format is supported.');
  const baseTree = parseTree(git(repo, ['ls-tree', '-r', '-z', 'HEAD']));
  for (const name of files.keys()) inspectPath(repo, name);
  const patchedTree = expectedPatchedTree(repo, baseTree, files, patch);
  const expected = reverse ? patchedTree : baseTree;
  // Added paths must also be absent on forward apply, even when ignored by Git.
  if (!reverse) for (const [name, item] of files) if (item.operation === 'add' && inspectPath(repo, name)) fail(`New file path is already occupied: ${name}. If the patch is installed, verify it with --reverse --check.`);
  checkState(repo, baseTree, expected);
  const applyArgs = ['apply', ...(reverse ? ['--reverse'] : []), '--whitespace=nowarn', '-'];
  git(repo, [...applyArgs.slice(0, -1), '--check', '-'], patch);
  if (!apply) { console.log(`Check passed: ${reverse ? 'reverse' : 'forward'} patch, ${files.size} files. The target checkout was not changed.`); return; }
  if (head() !== manifest.baseCommit) fail('HEAD changed during validation.');
  checkState(repo, baseTree, expected);
  for (const name of files.keys()) inspectPath(repo, name);
  git(repo, applyArgs, patch);
  checkState(repo, baseTree, reverse ? baseTree : patchedTree);
  console.log(reverse ? 'Reverse patch applied. Base files restored; HEAD and the index were not changed.' : 'Patch applied. HEAD and the index were not changed. Run the project validation steps next.');
}
try { main(); } catch (error) { console.error(`REFUSED: ${error.message}`); process.exitCode = 1; }
