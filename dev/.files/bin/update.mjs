#!/usr/bin/env node
/**
 * Update CLI.
 *
 * @note PLEASE DO NOT EDIT THIS FILE!
 * @note This entire file will be updated automatically.
 * @note Instead of editing here, please review <https://github.com/clevercanyon/skeleton>.
 */
/* eslint-env es2021, node */

import os from 'node:os';

import fs from 'node:fs';
import path from 'node:path';
import { dirname } from 'desm';
import fsp from 'node:fs/promises';

import mm from 'micromatch';
import { globby } from 'globby';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import chalk from 'chalk';
import * as se from 'shescape';

import u from './includes/utilities.mjs';
import coreProjects from './includes/core-projects.mjs';
import { splitCMD } from '@clevercanyon/split-cmd.fork';

u.propagateUserEnvVars(); // i.e., `USER_` env vars.

const __dirname = dirname(import.meta.url);
const projsDir = path.resolve(__dirname, '../../../..');
const projDir = path.resolve(__dirname, '../../..');

const { log } = console; // Shorter reference.

/**
 * NOTE: All of these commands _must_ be performed interactively. Please review the Yargs configuration below for
 * further details. At this time, there are no exceptions. Every update _must_ occur interactively.
 */

/**
 * Dotfiles command.
 */
class Dotfiles {
	/**
	 * Constructor.
	 */
	constructor(args) {
		this.args = args;
	}

	/**
	 * Runs CMD.
	 */
	async run() {
		await this.update();

		if (this.args.dryRun) {
			log(chalk.cyanBright('Dry run. This was all a simulation.'));
		}
	}

	/**
	 * Runs update.
	 */
	async update() {
		/**
		 * Skeleton.
		 */

		let skeletonBranch = 'main';

		if (await u.isPkgRepo('clevercanyon/skeleton')) {
			if (!(await u.isGitRepo())) {
				throw new Error('`clevercanyon/skeleton` is not a git repo.');
			}
			skeletonBranch = await u.gitCurrentBranch();
			// In a self-update scenario, always use the current skeleton branch.
			// Otherwise, the current branch would be wiped out by files from a different branch.
			// i.e., So we can work on a different branch and still have the ability to run a self-update.
		}
		const skeletonRepoURL = coreProjects.skeleton.repoURL; // From core projects.
		const skeletonRepoDir = path.resolve(os.tmpdir(), './clevercanyon/7fbdd94a-544e-4914-8955-22ab82bc6b29/' + skeletonBranch);

		/**
		 * Saves any pending skeleton changes; else checks state.
		 */

		if ((await u.isPkgRepo('clevercanyon/skeleton')) && (await u.isGitRepoDirty())) {
			log(chalk.green('Updating `clevercanyon/skeleton` git repo; `' + skeletonBranch + '` branch.'));
			log('    ' + chalk.green('i.e., saving latest skeleton changes before self-update.'));

			if (!this.args.dryRun) {
				await u.gitAddCommitPush((this.args.message + ' [d]').trim());
			}
		} else if (await u.isPkgRepo('clevercanyon/skeleton')) {
			// Don't perform a self-update if the remote isn't in sync with our local copy.
			if ((await u.gitLocalRepoSHA(projDir, skeletonBranch)) !== (await u.gitRemoteRepoSHA(skeletonRepoURL, skeletonBranch))) {
				throw new Error('`clevercanyon/skeleton` is out of sync with git remote origin; `' + skeletonBranch + '` branch.');
			}
		}

		/**
		 * Prepares latest skeleton.
		 */

		if (fs.existsSync(skeletonRepoDir) && (await u.gitLocalRepoSHA(skeletonRepoDir, skeletonBranch)) === (await u.gitRemoteRepoSHA(skeletonRepoURL, skeletonBranch))) {
			log(chalk.green('Using latest `clevercanyon/skeleton` from cache; `' + skeletonBranch + '` branch.'));
		} else {
			log(chalk.green('Git-cloning, and caching, latest `clevercanyon/skeleton`; `' + skeletonBranch + '` branch.'));
			if (!this.args.dryRun) {
				await fsp.rm(skeletonRepoDir, { recursive: true, force: true });
				await fsp.mkdir(skeletonRepoDir, { recursive: true }); // Starts fresh.
				await u.spawn('git', ['clone', skeletonRepoURL, skeletonRepoDir, '--branch', skeletonBranch, '--depth=1'], { cwd: skeletonRepoDir });
			}
			log(chalk.green('Installing `clevercanyon/skeleton`’s NPM dependencies; `' + skeletonBranch + '` branch.'));
			if (!this.args.dryRun) {
				await u.spawn('npm', ['ci'], { cwd: skeletonRepoDir });
			}
		}

		/**
		 * Runs updater using files from latest skeleton.
		 */

		log(chalk.green('Running updater using latest `clevercanyon/skeleton`; `' + skeletonBranch + '` branch.'));
		if (!this.args.dryRun) {
			await (await import(path.resolve(skeletonRepoDir, './dev/.files/bin/updater/index.mjs'))).default({ projDir });
		}

		/**
		 * Signals completion with success.
		 */

		log(await u.finale('Success', 'Dotfiles update complete.'));
	}
}

/**
 * Project command.
 */
class Project {
	/**
	 * Constructor.
	 */
	constructor(args) {
		this.args = args;
	}

	/**
	 * Runs CMD.
	 */
	async run() {
		await this.update();

		if (this.args.dryRun) {
			log(chalk.cyanBright('Dry run. This was all a simulation.'));
		}
	}

	/**
	 * Runs update.
	 */
	async update() {
		/**
		 * Updates NPM packages.
		 */

		log(chalk.green('Updating NPM packages.'));
		if (!this.args.dryRun) {
			await u.npmUpdate();
		}

		/**
		 * Checks org-wide GitHub repo standards.
		 */

		if (this.args.repos && (await u.isGitRepo()) && (await u.isGitRepoOriginGitHub())) {
			log(chalk.green('Repos will update, so checking GitHub repo org-wide standards.'));
			await u.githubCheckRepoOrgWideStandards({ dryRun: this.args.dryRun });
		}

		/**
		 * Pushes to Dotenv Vault, then encrypts, `./.env.vault`.
		 */
		// Also syncs GitHub repo environments using org-wide standards.

		if (this.args.repos && (await u.isEnvsVault())) {
			log(chalk.green('Repos will update, so pushing, then re-encrypting `./.env.vault`.'));
			await u.envsPush({ dryRun: this.args.dryRun });
		}

		/**
		 * Increments a publishable NPM package version.
		 */

		if (this.args.repos && this.args.pkgs && (await u.isNPMPkgPublishable({ mode: this.args.mode }))) {
			log(chalk.green('NPM package will publish, so incrementing version.'));
			await u.pkgIncrementVersion({ dryRun: this.args.dryRun });
		}

		/**
		 * Updates Vite build in the given mode.
		 */

		if (await u.isViteBuild()) {
			log(chalk.green('Updating Vite build; `' + this.args.mode + '` mode.'));
			if (!this.args.dryRun) {
				await u.viteBuild({ mode: this.args.mode });
			}
		}

		/**
		 * Updates repos and potentially publishes packages.
		 */

		if (this.args.repos) {
			/**
			 * Gets `./package.json` with a potentially incremented version.
			 */

			const pkg = await u.pkg(); // See version incrementation above.

			/**
			 * Publishes a new version of NPM package(s).
			 */
			// Also checks org-wide npmjs package standards.

			if (this.args.pkgs) {
				if (await u.isNPMPkgPublishable({ mode: this.args.mode })) {
					log(chalk.green('Publishing NPM package.'));
					await u.npmPublish({ dryRun: this.args.dryRun });
					//
				} else if (await u.isNPMPkg()) {
					log(chalk.gray('NPM package is not in a publishable state.'));
				} else {
					log(chalk.gray('Not an NPM package.'));
				}
			}

			/**
			 * Pushes changes to git repo(s).
			 */

			if (await u.isGitRepo()) {
				if (await u.isGitRepoDirty()) {
					log(chalk.green('Committing git repo changes; `' + (await u.gitCurrentBranch()) + '` branch.'));
					if (!this.args.dryRun) {
						await u.gitAddCommit((this.args.message + ' [p]').trim());
					}
				}
				if (this.args.pkgs && (await u.isNPMPkgPublishable({ mode: this.args.mode }))) {
					log(chalk.green('Creating git repo tag; `' + (await u.gitCurrentBranch()) + '` branch; `v' + pkg.version + '` tag.'));
					if (!this.args.dryRun) {
						await u.gitTag((this.args.message + ' [p][v' + pkg.version + ']').trim());
					}
				}
				log(chalk.green('Pushing to git repo; `' + (await u.gitCurrentBranch()) + '` branch.'));
				if (!this.args.dryRun) {
					await u.gitPush(); // Also pushes any tags.
				}
				if ((await u.isGitRepoOriginGitHub()) && this.args.pkgs && (await u.isNPMPkgPublishable({ mode: this.args.mode }))) {
					log(chalk.green('Generating GitHub release; `v' + pkg.version + '` tag.'));
					if (!this.args.dryRun) {
						await u.githubReleaseTag();
					}
				}
			} else {
				log(chalk.gray('Not a git repo.'));
			}
		}

		/**
		 * Signals completion with success.
		 */

		log(await u.finale('Success', 'Project update complete.'));
	}
}

/**
 * Projects command.
 */
class Projects {
	/**
	 * Constructor.
	 */
	constructor(args) {
		this.args = args;
	}

	/**
	 * Runs CMD.
	 */
	async run() {
		await this.update();

		if (this.args.dryRun) {
			log(chalk.cyanBright('Dry run. This was all a simulation.'));
		}
	}

	/**
	 * Runs update.
	 */
	async update() {
		/**
		 * Initializes vars.
		 */

		let i; // Initialize.
		const orderedResults = [];
		const hasAllGlob = this.args.glob.includes('*');

		/**
		 * Does git ignore setup.
		 */

		await this.doGitIgnoreSetup(); // `.~gitignore` file.

		/**
		 * Acquires unordered glob results.
		 */

		const unorderedResults = await globby(this.args.glob, {
			cwd: projsDir,
			onlyDirectories: true,
			expandDirectories: false,

			gitignore: true,
			ignoreFiles: ['.~gitignore'],
			ignore: coreProjects.updates.ignore.concat(this.args.ignore),
		});

		/**
		 * Produces an ordered set of glob results.
		 */

		for (const projDirSubpathGlob of coreProjects.updates.order.concat(this.args.order)) {
			for (const projDirSubpath of mm(unorderedResults, projDirSubpathGlob)) {
				if (-1 === (i = unorderedResults.indexOf(projDirSubpath))) {
					continue; // Not applicable.
				}
				orderedResults.push(unorderedResults[i]);
				unorderedResults.splice(i, 1);
			}
		}

		/**
		 * Iterates ordered + unordered glob results.
		 */

		for await (const projDirSubpath of orderedResults.concat(unorderedResults)) {
			/**
			 * Initializes vars.
			 */
			const projDir = path.resolve(projsDir, projDirSubpath);
			const projDisplayDir = path.basename(projsDir) + '/' + projDirSubpath;

			const devFilesDir = path.resolve(projDir, './dev/.files');
			const pkgFile = path.resolve(projDir, './package.json');

			/**
			 * Validates the current glob result.
			 */

			if (hasAllGlob && !fs.existsSync(devFilesDir)) {
				log(chalk.gray('Has glob `*`. No `./dev/.files` inside `' + projDisplayDir + '`. Bypassing.'));
				continue; // No `./dev/.files` directory.
			}
			if (hasAllGlob && !fs.existsSync(pkgFile)) {
				log(chalk.gray('Has glob `*`. No `./package.json` in `' + projDisplayDir + '`. Bypassing.'));
				continue; // No `./package.json` file.
			}

			/**
			 * Runs CMD(s) for current glob result.
			 */

			if (this.args.cmd) {
				for (const cmdArgs of this.args.cmd.split(/\s*&&\s*/u)) {
					const split = splitCMD(cmdArgs); // Splits into properties: `{cmd,args}`.

					const quotedCMD = se.quote(split.cmd); // Used only in output logging.
					const quotedArgs = se.quoteAll(split.args); // Only in output logging.

					log(chalk.green('Running `' + quotedCMD + (quotedArgs.length ? ' ' + quotedArgs.join(' ') : '') + '` in:') + ' ' + chalk.yellow(projDisplayDir));
					if (!this.args.dryRun) {
						await u.spawn(split.cmd, split.args, { cwd: projDir, stdio: 'inherit' });
					}
				}
			}

			/**
			 * Madruns script(s) for current glob result.
			 */

			if (this.args.run.length) {
				for (const run of this.args.run) {
					for (const cmdArgs of run.split(/\s*&&\s*/u)) {
						const split = splitCMD(cmdArgs); // Splits into properties: `{cmd,args}`.

						if (this.args.message && mm(split.cmd, 'update:{dotfiles,project}{,:}') && !mm(split.args, ['--message{,=}', '-m{,=}'])) {
							split.args = split.args.concat(['--message', this.args.message]);
						}
						const quotedCMD = se.quote(split.cmd); // Used only in output logging.
						const quotedArgs = se.quoteAll(split.args); // Only in output logging.

						log(chalk.green('Running `madrun ' + quotedCMD + (quotedArgs.length ? ' ' + quotedArgs.join(' ') : '') + '` in:') + ' ' + chalk.yellow(projDisplayDir));
						if (!this.args.dryRun) {
							await u.spawn('npx', ['@clevercanyon/madrun', split.cmd, ...split.args], { cwd: projDir, stdio: 'inherit' });
						}
					}
				}
			}
		}

		/**
		 * Signals completion with success.
		 */

		log(await u.finale('Success', 'Project updates complete.'));
	}

	/**
	 * Does git ignore setup.
	 */
	async doGitIgnoreSetup() {
		if (fs.existsSync(path.resolve(projDir, './.gitignore'))) {
			const gitIgnoreFile = path.resolve(projsDir, './.~gitignore');
			await fsp.copyFile(path.resolve(projDir, './.gitignore'), gitIgnoreFile);
		}
	}
}

/**
 * Yargs CLI config. ⛵🏴‍☠
 *
 * @see http://yargs.js.org/docs/
 */
void (async () => {
	await yargs(hideBin(process.argv))
		.command({
			command: ['dotfiles'],
			describe: 'Updates project dotfiles.',
			builder: (yargs) => {
				return yargs
					.options({
						message: {
							alias: 'm',
							type: 'string',
							requiresArg: true,
							demandOption: false,
							default: 'Dotfiles update.',
							description: 'Commit message when updating `clevercanyon/skeleton`.',
						},
						dryRun: {
							type: 'boolean',
							requiresArg: false,
							demandOption: false,
							default: false,
							description: 'Dry run?',
						},
					})
					.check(async (/* args */) => {
						if (!(await u.isInteractive())) {
							throw new Error('This *must* be performed interactively.');
						}
						return true;
					});
			},
			handler: async (args) => {
				await new Dotfiles(args).run();
			},
		})
		.command({
			command: ['project'],
			describe: 'Updates NPM packages + optionally pushes to repo(s) + optionally publishes package(s).',
			builder: (yargs) => {
				return yargs
					.options({
						repos: {
							type: 'boolean',
							requiresArg: false,
							demandOption: false,
							default: false,
							description: 'Push to project repo(s)?',
						},
						message: {
							alias: 'm',
							type: 'string',
							requiresArg: true,
							demandOption: false,
							default: 'Project update.',
							implies: ['repos'],
							description: 'Commit message when updating repos.',
						},
						pkgs: {
							type: 'boolean',
							requiresArg: false,
							demandOption: false,
							default: false,
							implies: ['repos'],
							description: 'Publish updated project package(s)?',
						},
						mode: {
							type: 'string',
							requiresArg: true,
							demandOption: false,
							default: 'prod',
							choices: ['dev', 'ci', 'stage', 'prod'],
							description: 'Build and env mode.',
						},
						dryRun: {
							type: 'boolean',
							requiresArg: false,
							demandOption: false,
							default: false,
							description: 'Dry run?',
						},
					})
					.check(async (/* args */) => {
						if (!(await u.isInteractive())) {
							throw new Error('This *must* be performed interactively.');
						}
						return true;
					});
			},
			handler: async (args) => {
				await new Project(args).run();
			},
		})
		.command({
			command: ['projects'],
			describe: 'Updates multiple projects.',
			builder: (yargs) => {
				return yargs
					.options({
						glob: {
							type: 'array',
							requiresArg: true,
							demandOption: false,
							default: ['*', '.github'],
							description:  // prettier-ignore
								'Glob matching is relative to `' + projsDir + '` and finds directories only.' +
								' Note: Globstars `**` are not allowed given the nature of this command and will therefore throw an error.' +
								' Please be more specific. Wildcards `*` are fine, but globstars `**` are prohibited in this option.',
						},
						ignore: {
							type: 'array',
							requiresArg: true,
							demandOption: false,
							default: coreProjects.updates.ignore,
							description: // prettier-ignore
								'Glob matching is relative to `' + projsDir + '`. This effectively excludes directories otherwise found by the `glob` option.' +
								' Note: The default ignore patterns are always in effect and cannot be overridden, only appended with this option.' +
								' Additionally, patterns in this project’s `.gitignore` file, and those within each matched project directory, are also always in effect.',
						},
						order: {
							type: 'array',
							requiresArg: true,
							demandOption: false,
							default: coreProjects.updates.order,
							description: // prettier-ignore
								'Project subpaths to prioritize, in order. Also, globbing is supported in this option, for loose ordering.' +
								' Note: It’s not necessary to list every single project directory, only those you need to prioritize, in a specific order.' +
								' Any that are not listed explicitly, in order, will run last, in an arbitrary glob-based ordering, which is generally unpredictable.' +
								' Note: The default ordering is always in effect and cannot be overridden, only appended with this option.',
						},
						cmd: {
							type: 'string',
							requiresArg: true,
							demandOption: false,
							default: '',
							description: // prettier-ignore
								'Arbitrary `[cmd] [args]` to run in each project directory.' +
								' Note: The use of `&&` is allowed, but the use of `||` or `|` pipes is not permitted at this time.' +
								' If both `cmd` and `run` are given, `cmd` will always run first.',
						},
						run: {
							type: 'array',
							requiresArg: true,
							demandOption: false,
							default: [],
							description: // prettier-ignore
								'Scripts to `madrun [cmd] [args]` in each project directory.' +
								' Note: The use of `&&` is allowed, but the use of `||` or `|` pipes is not permitted at this time.' +
								' If both `cmd` and `run` are given, `cmd` will always run first.',
						},
						message: {
							alias: 'm',
							type: 'string',
							requiresArg: true,
							demandOption: false,
							default: '', // No default value.
							description: 'Commit message when updating project repos.',
						},
						dryRun: {
							type: 'boolean',
							requiresArg: false,
							demandOption: false,
							default: false,
							description: 'Dry run?',
						},
					})
					.check(async (args) => {
						if (!args.glob.length) {
							throw new Error('Empty `glob` option.');
						}
						if (args.glob.includes('**') || mm(args.glob, ['\\*\\*'], { contains: true }).length) {
							throw new Error('Globstars `**` are prohitibed in `glob` option.');
						}
						if (!args.run.length && !args.cmd) {
							throw new Error('One of `cmd` and/or `run` is required.');
						}
						if (!(await u.isInteractive())) {
							throw new Error('This *must* be performed interactively.');
						}
						return true;
					});
			},
			handler: async (args) => {
				await new Projects(args).run();
			},
		})
		.fail(async (message, error /* , yargs */) => {
			if (error?.stack && typeof error.stack === 'string') log(chalk.gray(error.stack));
			log(await u.error('Problem', error ? error.toString() : message || 'Unexpected unknown errror.'));
			process.exit(1);
		})
		.strict()
		.parse();
})();
