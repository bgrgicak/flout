#!/usr/bin/env node
/**
 * Bumps versions, syncs inter-package dependency ranges, builds, and publishes
 * all workspace packages.
 *
 * Usage:
 *   npm run publish-all              # patch bump (0.4.0 -> 0.4.1)
 *   npm run publish-all -- minor     # minor bump (0.4.0 -> 0.5.0)
 *   npm run publish-all -- major     # major bump (0.4.0 -> 1.0.0)
 *   npm run publish-all -- 1.2.3     # explicit version
 *   npm run publish-all -- patch --otp=123456   # with npm 2FA one-time password
 *
 * Only packages currently at the root version are bumped (lockstep); packages
 * with independent versions (e.g. @flout/paf-flout) are left alone. Publishing
 * skips any package whose version already exists on the registry, so the
 * script is safe to re-run after a partial failure.
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function readPkg(path) {
	return JSON.parse(readFileSync(path, 'utf8'));
}

function writePkg(path, pkg) {
	writeFileSync(path, JSON.stringify(pkg, null, 2) + '\n');
}

function bump(version, type) {
	if (/^\d+\.\d+\.\d+$/.test(type)) {
		return type;
	}
	const [major, minor, patch] = version.split('.').map(Number);
	switch (type) {
		case 'major':
			return `${major + 1}.0.0`;
		case 'minor':
			return `${major}.${minor + 1}.0`;
		case 'patch':
			return `${major}.${minor}.${patch + 1}`;
		default:
			console.error(`Unknown bump type "${type}". Use patch, minor, major, or x.y.z.`);
			process.exit(1);
	}
}

function isPublished(name, version) {
	try {
		execSync(`npm view ${name}@${version} version`, { stdio: 'pipe' });
		return true;
	} catch {
		return false;
	}
}

const cliArgs = process.argv.slice(2);
const bumpType = cliArgs.find((arg) => !arg.startsWith('--')) ?? 'patch';
// Flags (e.g. --otp=123456) are forwarded to npm publish.
const publishFlags = cliArgs.filter((arg) => arg.startsWith('--')).join(' ');

const rootPkgPath = join(root, 'package.json');
const rootPkg = readPkg(rootPkgPath);
const oldVersion = rootPkg.version;
const newVersion = bump(oldVersion, bumpType);

const workspacePkgPaths = readdirSync(join(root, 'packages'))
	.map((dir) => join(root, 'packages', dir, 'package.json'))
	.filter((path) => existsSync(path));

// Bump every package in lockstep with the root version.
const allPkgPaths = [rootPkgPath, ...workspacePkgPaths];
const bumpedNames = new Set();
for (const path of allPkgPaths) {
	const pkg = readPkg(path);
	if (pkg.version === oldVersion) {
		bumpedNames.add(pkg.name);
	}
}

for (const path of allPkgPaths) {
	const pkg = readPkg(path);
	let changed = false;
	if (bumpedNames.has(pkg.name)) {
		pkg.version = newVersion;
		changed = true;
	}
	for (const depField of ['dependencies', 'devDependencies', 'peerDependencies']) {
		for (const dep of Object.keys(pkg[depField] ?? {})) {
			if (bumpedNames.has(dep) && pkg[depField][dep] !== '*') {
				pkg[depField][dep] = `^${newVersion}`;
				changed = true;
			}
		}
	}
	if (changed) {
		writePkg(path, pkg);
	}
}

console.log(`Bumped ${bumpedNames.size} packages: ${oldVersion} -> ${newVersion}`);

const run = (cmd) => execSync(cmd, { stdio: 'inherit', cwd: root });

run('npm install --package-lock-only');
run('npm run build');

let published = 0;
for (const path of workspacePkgPaths) {
	const pkg = readPkg(path);
	if (pkg.private) {
		continue;
	}
	if (isPublished(pkg.name, pkg.version)) {
		console.log(`Skipping ${pkg.name}@${pkg.version} (already published)`);
		continue;
	}
	try {
		// stdio is fully inherited so npm can prompt interactively for the
		// 2FA one-time password.
		run(`npm publish --workspace=${pkg.name} ${publishFlags}`.trim());
		published++;
	} catch {
		// The registry's read API can lag right after a publish, so the
		// isPublished pre-check may miss; re-check to tell a publish
		// conflict apart from a real failure.
		if (isPublished(pkg.name, pkg.version)) {
			console.log(`Skipping ${pkg.name}@${pkg.version} (already published)`);
			continue;
		}
		console.error(
			`\nPublishing ${pkg.name}@${pkg.version} failed — see npm output above.\n` +
				`Re-running \`npm run publish-all -- ${newVersion}\` is safe; already-published packages are skipped.`
		);
		process.exit(1);
	}
}

console.log(`\nPublished ${published} packages at version ${newVersion}.`);
console.log(`Don't forget to commit and tag: git commit -am "v${newVersion}" && git tag v${newVersion}`);
