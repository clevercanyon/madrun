/**
 * Default config file.
 */

import fs from 'node:fs';
import path from 'node:path';
import fsp from 'node:fs/promises';

import { findUp } from 'find-up';
import * as u from './resources/cli/utilities.js';

import { get as $brandꓺget } from '@clevercanyon/utilities/brand';
import { encode as $urlꓺencode } from '@clevercanyon/utilities/url';
import { spawn as $cmdꓺspawn } from '@clevercanyon/utilities.node/cmd';
import { cli as $yargsꓺcli } from '@clevercanyon/utilities.node/yargs';

import type { Props } from './resources/cli/cmds/run.js';

export default {
	/**
	 * Starts a new project.
	 */
	'new': [
		async ({ ctx }: Props): Promise<void> => {
			/**
			 * Yargs ⛵🏴‍☠.
			 */
			await (
				await $yargsꓺcli({
					strict: false,
					scriptName: 'madrun',
					errorBoxName: 'madrun',
					version: u.version,
				})
			)
				.command({
					command: ['new <dir> [template]'],
					describe: 'Starts a new project using an existing GitHub repo as a template.',
					builder: (yargs) => {
						return yargs
							.positional('dir', {
								type: 'string',
								describe: 'New directory basename, subpath, or absolute path.',
							})
							.positional('template', {
								type: 'string',
								default: '{{parentDirBasename}}/skeleton',
								description: // prettier-ignore
									'Git repository to clone and use as a template.' +
									' Can be a full URL, or just `owner/repo` will suffice when cloning a GitHub repository.' +
									' If there is no `/` in the value given, it’s auto-prefixed with `{{parentDirBasename}}/`.',
							})
							.options({
								from: {
									type: 'string',
									alias: ['clone'],
									requiresArg: true,
									demandOption: false,
									default: '',
									description: // prettier-ignore
										'Alternate way of passing [template]. Git repository to clone and use as a template.' +
										' Can be a full URL, or just `owner/repo` will suffice when cloning a GitHub repository.' +
										' If there is no `/` in the value given, it’s auto-prefixed with `{{parentDirBasename}}/`.',
								},
								branch: {
									type: 'string',
									requiresArg: true,
									demandOption: false,
									default: 'main',
									description: 'Git repository branch to use.',
								},
								pkg: {
									type: 'boolean',
									requiresArg: false,
									demandOption: false,
									default: false,
									description: // prettier-ignore
										'Indicates intent to publish the project as a package.' +
										' This option is simply passed to an `on::madrun:default:new` event handler.' +
										' The repository you’re cloning must support this option in it’s `.madrun.*` config file.',
								},
								pkgName: {
									type: 'string',
									requiresArg: true,
									demandOption: false,
									default: '',
									description: // prettier-ignore
										'Indicates intent to use a specific package name.' +
										' This option is simply passed to an `on::madrun:default:new` event handler.' +
										' The repository you’re cloning must support this option in it’s `.madrun.*` config file.',
								},
								public: {
									type: 'boolean',
									requiresArg: false,
									demandOption: false,
									default: false,
									description: // prettier-ignore
										'Indicates intent to create a public project.' +
										' This option is simply passed to an `on::madrun:default:new` event handler.' +
										' The repository you’re cloning must support this option in it’s `.madrun.*` config file.',
								},
							})
							.check(async (/* args */) => {
								return true;
							});
					},
					handler: async (args) => {
						/**
						 * Validates `dir` argument.
						 */

						if (!String(args.dir || '')) {
							throw new Error('Missing new directory location.');
						}

						/**
						 * Initializes a few variables.
						 */

						const dir = path.resolve(ctx.cwd, String(args.dir));
						const parentDir = path.dirname(dir); // One level up from new directory location.
						const parentDirBasename = path.basename(parentDir); // e.g., `c10n`, `clevercanyon`.

						const parentDirBrand = $brandꓺget(parentDirBasename);
						const parentDirOwner = parentDirBrand?.org?.slug || parentDirBasename;

						/**
						 * Further validates `dir` argument.
						 */

						if (fs.existsSync(dir)) {
							throw new Error('Directory already exists: `' + dir + '`.');
						}
						if (!fs.existsSync(parentDir)) {
							throw new Error('Nonexistent parent directory: `' + parentDir + '`.');
						}

						/**
						 * Establishes `branch` and `use` values.
						 */

						const branch = String(args.branch || 'main');
						let repoURL = String(args.from || args.template || '{{parentDirBasename}}/skeleton');
						repoURL = repoURL.replace(/\{{2}\s*parentDirBasename\s*\}{2}/giu, $urlꓺencode(parentDirOwner));

						if (repoURL.indexOf('/') === -1) repoURL = $urlꓺencode(parentDirOwner) + '/' + repoURL;
						if (repoURL.indexOf('//') === -1) repoURL = 'https://github.com/' + repoURL;
						if (!repoURL.endsWith('.git')) repoURL += '.git';

						/**
						 * Clones remote git repo and then deletes hidden `.git` directory.
						 */

						await $cmdꓺspawn('git', ['clone', repoURL, dir, '--branch', branch, '--depth=1'], { cwd: ctx.cwd });
						await fsp.rm(path.resolve(dir, './.git'), { recursive: true, force: true });

						/**
						 * Fires an event if new directory contains a `.madrun.*` config file.
						 */

						if (await findUp(u.configFiles, { cwd: dir, stopAt: dir })) {
							const argsToEventHandler = [
								...(args.pkg ? ['--pkg'] : []),
								...(args.pkgName ? ['--pkgName', String(args.pkgName)] : []),
								...(args.public ? ['--public'] : []),
							];
							await $cmdꓺspawn('npx', ['@clevercanyon/madrun', 'on::madrun:default:new', ...argsToEventHandler], { cwd: dir });
						}
					},
				})
				.parse();
		},
	],
};
