#!/usr/bin/env node
/**
 * CLI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { findUpSync } from 'find-up';

import chalk from 'chalk';
import * as se from 'shescape';

import _ꓺomit from 'lodash/omit.js';

import spawn from 'spawn-please';
import { execSync } from 'node:child_process';

import type { Arguments as YargsꓺArgs } from 'yargs';

const { error: err } = console; // Shorter reference.
const echo = process.stdout.write.bind(process.stdout);

const configFilesGlob = '.madrun.{js|cjs|mjs}';
const configFiles = ['.madrun.js', '.madrun.cjs', '.madrun.mjs'];

const regexAllCMDArgPartsValues = new RegExp('\\$\\{{1}@\\}{1}|\\{{2}@\\}{2}', 'gu');
const regexpRemainingCMDArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
const regexpRemainingCMDArgValues = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{1}', 'gu');
const omitFromNamedCMDArgs = ['$0', '_', 'madrunHelp', 'madrun-help', 'madrunVersion', 'madrun-version', 'madrunDebug', 'madrun-debug'];

/**
 * Interfaces.
 */
export type Args = YargsꓺArgs<{
	madrunDebug: boolean;
	madrunHelp: boolean;
	madrunVersion: boolean;
}>;
export interface Env {
	[x: string]: unknown;
}
export interface Opts {
	[x: string]: unknown;
}
export interface Config {
	[x: string]: string | string[] | CMDConfigFn;
}
export type CMDConfigFn = (cmdArgs: CMDConfigFnCMDArgs, ctxUtils: CMDConfigFnCTXUtils) => Promise<CMDConfigFnRtns>;
export type CMDConfigFnSync = (cmdArgs: CMDConfigFnCMDArgs, ctxUtils: CMDConfigFnCTXUtils) => CMDConfigFnRtns;
export type CMDConfigFnCMDArgs = Omit<YargsꓺArgs<Args>, '$0'>;
export interface CMDConfigFnCTXUtils {
	cwd: string;
	se: typeof se;
	chalk: typeof chalk;
}
export type CMDConfigFnRtns =
	| string
	| string[]
	| {
			env?: Env;
			cmds: CMDConfigFnRtnObjCMDs;
			opts?: Opts;
	  };
export type CMDConfigFnRtnObjCMDs =
	| string
	| Array<
			| string
			| {
					env?: Env;
					cmd: string;
					opts?: Opts;
			  }
	  >;
export interface CMDConfigData {
	env: Env;
	cmds: Array<{
		env: Env;
		cmd: string;
		opts: Opts;
	}>;
	opts: Opts;
}

/**
 * Run command.
 */
export default class Run {
	/**
	 * Yargs args.
	 */
	protected args: YargsꓺArgs;

	/**
	 * Called CMD name.
	 */
	protected cmdName: string;

	/**
	 * Called CMD args; passed to config function.
	 */
	protected cmdArgs: CMDConfigFnCMDArgs;

	/**
	 * Config file location.
	 */
	protected configFile: string;

	/**
	 * Config file directory as CWD.
	 */
	protected cwd: string;

	/**
	 * Constructor.
	 */
	public constructor(args: YargsꓺArgs) {
		this.args = args;

		this.cmdName = String(args._?.[0] || '');
		this.cmdArgs = {
			_: args._.slice(1),
			..._ꓺomit(args, omitFromNamedCMDArgs),
		};
		if ('' === this.cmdName) {
			throw new Error('Missing command name.');
		}
		this.configFile = findUpSync(configFiles) as string;

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
	public async run(): Promise<void> {
		await this.maybeInstallNodeModules();
		const cmdConfigData = await this.cmdConfigData();

		for (const cmdData of cmdConfigData.cmds) {
			// Populates env vars & replacement codes in given CMD.
			const cmd = await this.populateCMD(cmdData.env, cmdData.cmd);

			if (this.args.madrunDebug) {
				err(chalk.black('> rawEnv:') + ' ' + chalk.gray(JSON.stringify(cmdData.env, null, 4)));
				err(chalk.black('> rawCMD:') + ' ' + chalk.gray(cmdData.cmd)); // String CMD.
				err(chalk.black('> rawOpts:') + ' ' + chalk.gray(JSON.stringify(cmdData.opts, null, 4)));
				err(chalk.black('> cmd:') + ' ' + chalk.gray(cmd));
				err(chalk.black('> ---'));
			}
			await this.exec(cmd, cmdData.opts);
		}
	}

	/**
	 * Installs node modules; maybe.
	 */
	protected async maybeInstallNodeModules(): Promise<void> {
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
	 * @param   cmd  CMD + any args, or shell script to run.
	 * @param   opts Any additional execSync options.
	 *
	 * @returns      Empty string when `stdio: 'inherit'` (default). Stdout when `stdio: 'pipe'`.
	 */
	protected async exec(cmd: string, opts: { [x: string]: unknown } = {}): Promise<string> {
		return (
			execSync(cmd, {
				cwd: this.cwd,
				shell: 'bash',
				stdio: 'inherit',
				env: {
					...process.env,
					PARENT_IS_TTY:
						process.stdout.isTTY || //
						process.env.PARENT_IS_TTY
							? 'true'
							: 'false',
				},
				...opts,
			}) || Buffer.from('')
		).toString();
	}

	/**
	 * Spawns command line operation.
	 *
	 * @param   cmd  CMD name or path.
	 * @param   args Any CMD arguments.
	 * @param   opts Any additional spawn options.
	 *
	 * @returns      Empty string when `stdio: 'inherit'` (default). Stdout when `stdio: 'pipe'`.
	 */
	protected async spawn(cmd: string, args: string[] = [], opts: { [x: string]: unknown } = {}): Promise<string> {
		if ('shell' in opts ? opts.shell : 'bash') {
			// When using a shell, we must escape everything ourselves.
			// i.e., Node does not escape `cmd` or `args` when a `shell` is given.
			(cmd = se.quote(cmd)), (args = se.quoteAll(args));
		}
		return await spawn(cmd, args, {
			cwd: this.cwd,
			shell: 'bash',
			stdio: 'inherit',
			env: {
				...process.env,
				PARENT_IS_TTY:
					process.stdout.isTTY || //
					process.env.PARENT_IS_TTY
						? 'true'
						: 'false',
			},
			// Output handlers do not run when `stdio: 'inherit'` or `quiet: true`.
			stdout: opts.quiet ? null : (buffer: Buffer) => echo(chalk.white(buffer.toString())),
			stderr: opts.quiet ? null : (buffer: Buffer) => echo(chalk.gray(buffer.toString())),

			..._ꓺomit(opts, ['quiet']),
		});
	}

	/**
	 * Parses config file.
	 *
	 * @returns Configuration.
	 */
	protected async config(): Promise<Config> {
		const configFile = this.configFile;

		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
		// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
		const config = (await import(configFile)).default as Config;

		if (typeof config !== 'object') {
			throw new Error('`' + path.basename(configFile) + '` config failure.');
		}
		return config;
	}

	/**
	 * Gets config function for current `cmdName`.
	 *
	 * @returns CMD config function.
	 */
	protected async cmdConfigFn(): Promise<CMDConfigFn> {
		const config = await this.config();
		let configFn = config[this.cmdName] || null;

		if (typeof configFn === 'string') {
			configFn = async (): Promise<string> => configFn as unknown as string;
		}
		if (configFn instanceof Array) {
			configFn = async (): Promise<CMDConfigFnRtns> =>
				(configFn as unknown as Array<unknown>).map((cmd) => {
					if (typeof cmd !== 'string') {
						throw new Error('`' + this.cmdName + '` command is not available.');
					}
					return cmd; // Strings are nice.
				});
		}
		if (typeof configFn !== 'function') {
			throw new Error('`' + this.cmdName + '` command is not available.');
		}
		if (configFn.constructor.name !== 'AsyncFunction') {
			configFn = async (...args): Promise<CMDConfigFnRtns> => (configFn as unknown as CMDConfigFnSync)(...args);
		}
		return configFn;
	}

	/**
	 * Gets config data for current `cmdName`.
	 *
	 * @returns CMD configuration data.
	 */
	protected async cmdConfigData(): Promise<CMDConfigData> {
		const ctxUtils = {
			cwd: this.cwd, // CWD.
			se, // Shell escape|quote.
			chalk, // Chalk string colorizer.
		};
		const configFn = await this.cmdConfigFn();
		let configFnRtn = await configFn(this.cmdArgs, ctxUtils);

		configFnRtn = typeof configFnRtn === 'string' ? { cmds: '' === configFnRtn ? [] : [configFnRtn] } : configFnRtn;
		configFnRtn = configFnRtn instanceof Array ? { cmds: configFnRtn } : configFnRtn; // Converts array in previous line.

		if (typeof configFnRtn !== 'object') {
			throw new Error('`' + this.cmdName + '` command config has an invalid data type.');
		}
		configFnRtn = Object.assign({ env: {}, cmds: [], opts: {} }, configFnRtn);
		configFnRtn.cmds = typeof configFnRtn.cmds === 'string' ? ('' === configFnRtn.cmds ? [] : [configFnRtn.cmds]) : configFnRtn.cmds;

		if (typeof configFnRtn.env !== 'object') {
			throw new Error('`' + this.cmdName + '` command config contains invalid data for derived `env` property.');
		}
		if (!(configFnRtn.cmds instanceof Array) || !configFnRtn.cmds.length) {
			throw new Error('`' + this.cmdName + '` command config contains invalid data for derived `cmds` property.');
		}
		if (typeof configFnRtn.opts !== 'object') {
			throw new Error('`' + this.cmdName + '` command config contains invalid data for derived `opts` property.');
		}
		for (let i = 0; i < configFnRtn.cmds.length; i++) {
			let cmdData = configFnRtn.cmds[i];
			cmdData = typeof cmdData === 'string' ? { cmd: cmdData } : cmdData;

			if (typeof cmdData !== 'object') {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with an invalid data type.');
			}
			cmdData = Object.assign({ cmd: '' }, { env: configFnRtn.env, opts: configFnRtn.opts }, cmdData);
			configFnRtn.cmds[i] = cmdData; // Update config data object now with merged/massaged data.

			if (typeof cmdData.env !== 'object') {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with invalid data for its derived `env` property.');
			}
			if (typeof cmdData.cmd !== 'string' || !cmdData.cmd) {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with invalid data for its derived `cmd` property.');
			}
			if (typeof cmdData.opts !== 'object') {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with invalid data for its derived `opts` property.');
			}
		}
		return configFnRtn as CMDConfigData;
	}

	/**
	 * Populates a given env + CMD.
	 *
	 * @param   env Environment vars.
	 * @param   cmd CMD + any args, or shell script to run.
	 *
	 * @returns     Populated environment vars as code + CMD w/ any args; or shell script to run.
	 */
	protected async populateCMD(env: Env, cmd: string): Promise<string> {
		const popEnv = await this.populateCMDEnvVars(env);
		const popCMD = await this.populateCMDReplacementCodes(cmd);
		return popEnv ? popEnv + ' ' + popCMD : popCMD;
	}

	/**
	 * Populates environment vars for a given CMD.
	 *
	 * @param   env Environment vars.
	 *
	 * @returns     Populated environment vars, as code.
	 */
	protected async populateCMDEnvVars(env: Env): Promise<string> {
		let vars = ''; // Initialize.

		for (const [name, value] of Object.entries(env)) {
			vars += ' export ' + name + '=' + se.quote(String(value)) + ';';
		}
		return vars.trim();
	}

	/**
	 * Populates replacement codes in a given CMD.
	 *
	 * @param   cmd CMD + any args, or shell script to run.
	 *
	 * @returns     Populated CMD + any args, or shell script to run.
	 */
	protected async populateCMDReplacementCodes(cmd: string): Promise<string> {
		(this.cmdArgs._ as Array<string | number>).forEach((v, i) => {
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

			for (const v of this.cmdArgs._ as Array<string | number>) {
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

	/**
	 * Escapes a string for use in a regular expression.
	 *
	 * @returns Escaped string for use in a regular expression.
	 */
	protected escRegExp(str: string): string {
		return str.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
	}
}
