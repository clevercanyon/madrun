#!/usr/bin/env node
/**
 * `madrun` CLI.
 */
/* eslint-env es2021, node */

import _ꓺomit from 'lodash/omit.js';

import fs from 'node:fs';
import path from 'node:path';
import { dirname } from 'desm';
import { findUpSync } from 'find-up';

import * as se from 'shescape';
import spawn from 'spawn-please';
import { execSync } from 'node:child_process';

import coloredBox from 'boxen';
import chalk, { supportsColor } from 'chalk';

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

const __dirname = dirname(import.meta.url);
const pkgFile = path.resolve(__dirname, './package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile).toString());

const { error: err } = console; // Shorter reference.

const configFilesGlob = ['.madrun.{js|cjs|mjs}'];
const configFiles = ['.madrun.js', '.madrun.cjs', '.madrun.mjs'];

const regexAllCMDArgPartsValues = new RegExp('\\$\\{{1}@\\}{1}|\\{{2}@\\}{2}', 'gu');
const regexpRemainingCMDArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
const regexpRemainingCMDArgValues = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{1}', 'gu');
const omitFromNamedCMDArgs = ['$0', '_', 'madrunHelp', 'madrun-help', 'madrunVersion', 'madrun-version', 'madrunDebug', 'madrun-debug'];

/**
 * Run command.
 */
class Run {
	/**
	 * Constructor.
	 */
	constructor(args) {
		this.args = args;

		this.cmdName = args._?.[0] || '';
		this.cmdArgs = {
			_: args._.slice(1),
			..._ꓺomit(args, omitFromNamedCMDArgs),
		};
		if ('' === this.cmdName) {
			throw new Error('Missing command name.');
		}
		this.configFile = findUpSync(configFiles);

		if (!this.configFile) {
			throw new Error('`' + configFilesGlob + '` not found!');
		}
		this.cwd = path.dirname(this.configFile);

		if (this.args.madrunDebug) {
			err(chalk.black('> cwd:') + ' ' + chalk.gray(this.cwd));
			err(chalk.black('> args:') + ' ' + chalk.gray(JSON.stringify(this.args, null, 4)));
			err(chalk.black('> ---'));

			err(chalk.black('> cmdName:') + ' ' + chalk.gray(this.cmdName));
			err(chalk.black('> cmdArgs:') + ' ' + chalk.gray(JSON.stringify(this.cmdArgs, null, 4)));
			err(chalk.black('> ---'));
		}
	}

	/**
	 * Runs CMD.
	 */
	async run() {
		await this.maybeInstallNodeModules();

		for (const rawCMD of await this.cmds()) {
			// Populates replacement codes in given CMD.
			const cmd = await this.populateReplacementCodes(rawCMD);

			if (this.args.madrunDebug) {
				err(chalk.black('> rawCMD:') + ' ' + chalk.gray(rawCMD));
				err(chalk.black('> cmd:') + ' ' + chalk.gray(cmd));
				err(chalk.black('> ---'));
			}
			await this.exec(cmd); // @todo Allow scripts to set options.
		}
	}

	/**
	 * Installs node modules; maybe.
	 */
	async maybeInstallNodeModules() {
		const pkgFile = path.resolve(this.cwd, './package.json');
		const nodeModulesDir = path.resolve(this.cwd, './node_modules');

		if (!fs.existsSync(pkgFile) || fs.existsSync(nodeModulesDir)) {
			return; // Nothing to do in these cases.
		}
		const pkgLockFile = path.resolve(this.cwd, './package-lock.json');
		const npmShrinkwrapFile = path.resolve(this.cwd, './npm-shrinkwrap.json');

		if (this.args.madrunDebug) {
			err(chalk.black('> Auto-installing node modules.'));
			err(chalk.black('> ---'));
		}
		await this.spawn('npm', fs.existsSync(pkgLockFile) || fs.existsSync(npmShrinkwrapFile) ? ['ci'] : ['install']);
	}

	/**
	 * Executes command line operation.
	 *
	 * @param   {string}          cmd  CMD + any args.
	 * @param   {object}          opts Any additional options.
	 *
	 * @returns {Promise<string>}      Empty string when `stdio: 'inherit'` (default). Stdout when `stdio: 'pipe'`.
	 */
	async exec(cmd, opts = {}) {
		return (
			execSync(cmd, {
				cwd: this.cwd,
				shell: 'bash',
				stdio: 'inherit',
				encoding: 'utf-8',
				env: {
					...process.env,
					PARENT_IS_TTY:
						process.stdout.isTTY || //
						process.env.PARENT_IS_TTY
							? true
							: false,
				},
				...opts,
			}) || ''
		);
	}

	/**
	 * Spawns command line operation.
	 *
	 * @param   {string}          cmd  CMD.
	 * @param   {string[]}        args Arguments.
	 * @param   {object}          opts Any additional options.
	 *
	 * @returns {Promise<string>}      Empty string when `stdio: 'inherit'` (default). Stdout when `stdio: 'pipe'`.
	 */
	async spawn(cmd, args = [], opts = {}) {
		return await spawn(cmd, args, {
			cwd: this.cwd,
			shell: 'bash',
			stdio: 'inherit',
			env: {
				...process.env,
				PARENT_IS_TTY:
					process.stdout.isTTY || //
					process.env.PARENT_IS_TTY
						? true
						: false,
			},
			// Output handlers do not run when `stdio: 'inherit'` or `quiet: true`.
			stdout: opts.quiet ? null : (buffer) => echo(chalk.white(buffer.toString())),
			stderr: opts.quiet ? null : (buffer) => echo(chalk.gray(buffer.toString())),

			..._ꓺomit(opts, ['quiet']),
		});
	}

	/**
	 * Parses config file.
	 */
	async config() {
		const configFile = this.configFile;
		const config = (await import(configFile)).default;

		if (typeof config !== 'object') {
			throw new Error('`' + path.basename(configFile) + '` config failure.');
		}
		return config;
	}

	/**
	 * Gets CMD function from config file.
	 */
	async cmdFn() {
		const config = await this.config();
		const cmdFn = config[this.cmdName] || null;

		if (typeof cmdFn !== 'function') {
			throw new Error('`' + this.cmdName + '` command is not available.');
		}
		return cmdFn;
	}

	/**
	 * Gets CMDs from config file CMD function.
	 */
	async cmds() {
		const cmdFn = await this.cmdFn();
		let cmds = await cmdFn(this.cmdArgs, { cwd: this.cwd, se });
		cmds = typeof cmds === 'string' && '' !== cmds ? [cmds] : cmds;

		if (!(cmds instanceof Array)) {
			throw new Error('`' + this.cmdName + '` command has invalid data.');
		}
		return cmds;
	}

	/**
	 * Populates CMD replacement codes.
	 */
	async populateReplacementCodes(cmd) {
		this.cmdArgs._.forEach((v, i) => {
			const pos = String(i + 1);
			const escREPos = this.escRegExp(pos);

			const argValue = se.quote(String(v));
			// Both formats supported for consistency, but always populated by value.

			const regExpArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escREPos + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
			const regExpArgValue = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escREPos + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu');

			cmd = cmd.replace(regExpArgParts, argValue).replace(regExpArgValue, argValue);
		});
		for (const [n, v] of Object.entries(_ꓺomit(this.cmdArgs, omitFromNamedCMDArgs))) {
			const prefix = '-'.repeat(1 === n.length ? 1 : 2);
			const escREName = this.escRegExp(prefix + n);

			const argParts = se.quote(prefix + n) + (true === v ? '' : ' ' + se.quote(String(v)));
			const argValue = true === v ? '' : se.quote(String(v));

			cmd = cmd.replace(new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escREName + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu'), argParts);
			cmd = cmd.replace(new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escREName + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu'), argValue);
		}
		cmd = cmd.replace(regexAllCMDArgPartsValues, (/* All arguments. Both formats supported for consistency. */) => {
			const args = []; // Initialize list of arguments.

			for (const v of this.cmdArgs._) {
				args.push(String(v)); // Positional argument.
			}
			for (const [n, v] of Object.entries(_ꓺomit(this.cmdArgs, omitFromNamedCMDArgs))) {
				const prefix = '-'.repeat(1 === n.length ? 1 : 2);
				const name = prefix + n;

				args.push(name); // Named argument.
				true === v ? null : args.push(String(v));
			}
			return se.quoteAll(args).join(' ');
		});
		// Empty any others remaining; i.e., that were not already filled above.
		cmd = cmd.replace(regexpRemainingCMDArgParts, '').replace(regexpRemainingCMDArgValues, '');

		// Finally, compress any superfluous whitespace left behind by replacements.
		return cmd.replace(/[\t ]+/gu, ' ').trim();
	}

	/*
	 * Escapes a string for use in a regular expression.
	 */

	escRegExp(str) {
		return str.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	}
}

/**
 * Utilities.
 */
class u {
	/**
	 * Error utilities.
	 */
	static async error(title, text) {
		if (!process.stdout.isTTY || !supportsColor?.has16m) {
			return chalk.red(text); // No box.
		}
		return (
			'\n' +
			coloredBox(chalk.bold.red(text), {
				margin: 0,
				padding: 0.75,
				textAlignment: 'left',

				dimBorder: false,
				borderStyle: 'round',
				borderColor: '#551819',
				backgroundColor: '',

				titleAlignment: 'left',
				title: chalk.bold.redBright('⚑ ' + title),
			})
		);
	}

	/**
	 * Finale utilities.
	 */
	static async finale(title, text) {
		if (!process.stdout.isTTY || !supportsColor?.has16m) {
			return chalk.green(text); // No box.
		}
		return (
			'\n' +
			coloredBox(chalk.bold.hex('#ed5f3b')(text), {
				margin: 0,
				padding: 0.75,
				textAlignment: 'left',

				dimBorder: false,
				borderStyle: 'round',
				borderColor: '#8e3923',
				backgroundColor: '',

				titleAlignment: 'left',
				title: chalk.bold.green('✓ ' + title),
			})
		);
	}
}

/**
 * Yargs CLI config. ⛵🏴‍☠
 *
 * @see http://yargs.js.org/docs/
 */
(async () => {
	await yargs(hideBin(process.argv))
		.command({
			command: ['$0'],
			desc: 'Runs one or more commands configured by a mad JS file; in sequence.',
			builder: (yargs) => {
				yargs
					.options({
						madrunDebug: {
							type: 'boolean',
							requiresArg: false,
							demandOption: false,
							default: false,
							description: 'Debug?',
						},
					})
					.check(async (/* args */) => {
						return true;
					});
			},
			handler: async (args) => {
				await new Run(args).run();
			},
		})
		.fail(async (message, error /* , yargs */) => {
			if (error?.stack && typeof error.stack === 'string') err(chalk.gray(error.stack));
			err(await u.error('Problem', error ? error.toString() : message || 'Unexpected unknown errror.'));
			process.exit(1);
		})
		.help('madrunHelp')
		.version('madrunVersion', pkg.version)
		.parse();
})();