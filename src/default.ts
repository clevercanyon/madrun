/**
 * Default config file.
 */

import fs from 'node:fs';
import path from 'node:path';
import fsp from 'node:fs/promises';

import yArgs from 'yargs';
import { hideBin } from 'yargs/helpers';

import { error as uꓺerror } from './resources/cli/utilities.js';
import type { CMDFnArgs, CMDFnCtxUtils } from './resources/cli/cmds/run.js';

declare const $$__APP_PKG_VERSION__$$: string;

export default {
	/**
	 * Starts a new project.
	 */
	'new': [
		async (args: CMDFnArgs, u: CMDFnCtxUtils): Promise<void> => {
			const yargs = yArgs(hideBin(process.argv));
			await yargs
				.scriptName('madrun')
				.parserConfiguration({
					'dot-notation': false,
					'strip-aliased': true,
					'strip-dashed': true,
					'greedy-arrays': true,
					'boolean-negation': false,
				})
				.version('version', $$__APP_PKG_VERSION__$$)
				.wrap(Math.max(80, yargs.terminalWidth() / 2))

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

						const dir = path.resolve(u.cwd, String(args.dir));
						const parentDir = path.dirname(dir); // One level up from new directory location.
						const parentDirBasename = path.basename(parentDir); // e.g., `clevercanyon`.

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

						repoURL = repoURL.replace(/\{{2}\s*parentDirBasename\s*\}{2}/giu, parentDirBasename);
						if (repoURL.indexOf('/') === -1) repoURL = parentDirBasename + '/' + repoURL;
						if (repoURL.indexOf('//') === -1) repoURL = 'https://github.com/' + repoURL;
						if (!repoURL.endsWith('.git')) repoURL += '.git';

						/**
						 * Clones remote git repo and then deletes hidden `.git` directory.
						 */

						await u.spawn('git', ['clone', repoURL, dir, '--branch', branch, '--depth=1']);
						await fsp.rm(path.resolve(dir, './.git'), { recursive: true, force: true });

						/**
						 * Fires an event if new directory contains a `.madrun.*` config file.
						 */

						if (await u.findUp(u.configFiles, { cwd: dir, stopAt: dir })) {
							const argsToEventHandler = [
								...(args.pkg ? ['--pkg'] : []),
								...(args.pkgName ? ['--pkgName', String(args.pkgName)] : []),
								...(args.public ? ['--public'] : []),
							];
							await u.spawn('npx', ['@clevercanyon/madrun', 'on::madrun:default:new', ...argsToEventHandler], { cwd: dir });
						}
					},
				})
				.fail(async (message, error /* , yargs */) => {
					if (error?.stack && typeof error.stack === 'string') u.err(u.chalk.gray(error.stack));
					u.err(await uꓺerror('madrun: Problem', error ? error.toString() : message || 'Unexpected unknown errror.'));
					process.exit(1);
				})
				.parse();
		},
	],
};
