#!/usr/bin/env node
/**
 * CLI.
 */

import fs from 'node:fs';
import path from 'node:path';
import { findUp, findUpSync } from 'find-up';

import chalk from 'chalk';
import * as se from 'shescape';

import _ꓺomit from 'lodash/omit.js';
import * as u from '../utilities.js';

import type { Arguments as YargsꓺArgs } from 'yargs';
const { log } = console; // Shorter reference.

const configFiles = ['.madrun.js', '.madrun.cjs', '.madrun.mjs'];
const regexAllCMDArgPartsValues = new RegExp('\\$\\{{1}@\\}{1}|\\{{2}@\\}{2}', 'gu');
const regexpRemainingCMDArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
const regexpRemainingCMDArgValues = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{1}', 'gu');
const omitFromNamedCMDArgs = ['$0', '_', 'madrunHelp', 'madrunVersion', 'madrunDebug'];

/**
 * Interfaces.
 */
export type Args = YargsꓺArgs<{
	madrunHelp: boolean;
	madrunVersion: boolean;
	madrunDebug: boolean;
}>;

export interface Env {
	[x: string]: unknown;
}
export interface Opts {
	[x: string]: unknown;
}

export interface Config {
	[x: string]:
		| string
		| CMDConfigFn
		| CMDConfigFnSync
		| Array<string | CMDFn | CMDFnSync>
		| {
				env?: Env;
				cmds: CMDConfigFnRtnObjCMDs;
				opts?: Opts;
		  };
}
export type CMDConfigFn = (cmdArgs: CMDConfigFnCMDArgs, ctxUtils: CMDConfigFnCtxUtils) => Promise<CMDConfigFnRtns>;
export type CMDConfigFnSync = (cmdArgs: CMDConfigFnCMDArgs, ctxUtils: CMDConfigFnCtxUtils) => CMDConfigFnRtns;
export type CMDConfigFnCMDArgs = Omit<Args, '$0' | 'madrunHelp' | 'madrunVersion' | 'madrunDebug'>;
export interface CMDConfigFnCtxUtils {
	cwd: string;
	se: typeof se;
	chalk: typeof chalk;
}
export type CMDConfigFnRtns =
	| string
	| CMDFn
	| CMDFnSync
	| Array<string | CMDFn | CMDFnSync>
	| {
			env?: Env;
			cmds: CMDConfigFnRtnObjCMDs;
			opts?: Opts;
	  };
export type CMDConfigFnRtnObjCMDs =
	| string
	| CMDFn
	| CMDFnSync
	| Array<
			| string
			| CMDFn
			| CMDFnSync
			| {
					env?: Env;
					cmd: string | CMDFn | CMDFnSync;
					opts?: Opts;
			  }
	  >;

export type CMDFn = (cmdArgs: CMDFnArgs, ctxUtils: CMDFnCtxUtils) => Promise<void>;
export type CMDFnSync = (cmdArgs: CMDFnArgs, ctxUtils: CMDFnCtxUtils) => void;
export type CMDFnArgs = Omit<Args, '$0' | 'madrunHelp' | 'madrunVersion' | 'madrunDebug'>;
export interface CMDFnCtxUtils {
	cwd: string;
	se: typeof se;
	chalk: typeof chalk;

	env: Env;
	opts: Opts;

	exec: typeof u.exec;
	spawn: typeof u.spawn;

	findUp: typeof findUp;
	configFiles: typeof configFiles;
}

export interface CMDConfigData {
	env: Env;
	cmds: Array<{
		env: Env;
		cmd: string | CMDFn;
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

		if (this.configFile) {
			this.cwd = path.dirname(this.configFile);
		} else {
			this.cwd = process.cwd();
			this.configFile = 'default';
		}
		if (this.args.madrunDebug) {
			log(chalk.black('> cwd:') + ' ' + chalk.gray(this.cwd));
			log(chalk.black('> configFile:') + ' ' + chalk.gray(this.configFile));
			log(chalk.black('> args:') + ' ' + chalk.gray(JSON.stringify(this.args, null, 4)));
			log(chalk.black('> ---'));

			log(chalk.black('> cmdName:') + ' ' + chalk.gray(this.cmdName));
			log(chalk.black('> cmdArgs:') + ' ' + chalk.gray(JSON.stringify(this.cmdArgs, null, 4)));
			log(chalk.black('> ---'));
		}
	}

	/**
	 * Runs CMD.
	 */
	public async run(): Promise<void> {
		await this.maybeInstallNodeModules();
		const cmdConfigData = await this.cmdConfigData();

		for (const cmdData of cmdConfigData.cmds) {
			if (typeof cmdData.cmd === 'function') {
				if (this.args.madrunDebug) {
					log(chalk.black('> rawEnv:') + ' ' + chalk.gray(JSON.stringify(cmdData.env, null, 4)));
					log(chalk.black('> rawCMD:') + ' ' + chalk.gray('[function]')); // Function CMD.
					log(chalk.black('> rawOpts:') + ' ' + chalk.gray(JSON.stringify(cmdData.opts, null, 4)));
					log(chalk.black('> ---'));
				}
				const ctxUtils = {
					cwd: this.cwd, // CWD.
					se, // Shell escape|quote.
					chalk, // Chalk string colorizer.

					env: cmdData.env, // Env vars for CMD.
					opts: cmdData.opts, // Options for CMD.

					exec: u.exec, // Exec utility.
					spawn: u.spawn, // Spawn utility.

					findUp: findUp, // findUp utility.
					configFiles, // Config files array.
				};
				await cmdData.cmd(this.cmdArgs, ctxUtils);
			} else {
				// Populates env vars & replacement codes in given CMD.
				const cmd = await this.populateCMD(cmdData.env, cmdData.cmd);

				if (this.args.madrunDebug) {
					log(chalk.black('> rawEnv:') + ' ' + chalk.gray(JSON.stringify(cmdData.env, null, 4)));
					log(chalk.black('> rawCMD:') + ' ' + chalk.gray(cmdData.cmd)); // String CMD.
					log(chalk.black('> rawOpts:') + ' ' + chalk.gray(JSON.stringify(cmdData.opts, null, 4)));
					log(chalk.black('> cmd:') + ' ' + chalk.gray(cmd));
					log(chalk.black('> ---'));
				}
				await u.exec(cmd, { cwd: this.cwd, ...cmdData.opts });
			}
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
			log(chalk.black('> Auto-installing node modules.'));
			log(chalk.black('> ---'));
		}
		await u.spawn('npm', fs.existsSync(pkgLockFile) || fs.existsSync(npmShrinkwrapFile) ? ['ci'] : ['install'], { cwd: this.cwd });
	}

	/**
	 * Parses config file.
	 *
	 * @returns Configuration.
	 */
	protected async config(): Promise<Config> {
		let config = null; // Initialize.
		const configFile = this.configFile;

		if ('default' === this.configFile) {
			config = (await import('../../../default.js')).default as Config;
		} else {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
			config = (await import(configFile)).default as Config;
		}
		if (typeof config !== 'object') {
			throw new Error('`' + path.basename(configFile) + '` config failure.');
		}
		return config;
	}

	/**
	 * Gets config function for current `cmdName`.
	 *
	 * @returns CMD config function; else `null` if CMD is unavailable.
	 */
	protected async cmdConfigFn(): Promise<CMDConfigFn | null> {
		const config = await this.config();
		let configFn = config[this.cmdName] || null;

		if (null === configFn && this.cmdName.startsWith('on::')) {
			return null; // Event w/ no listener.
		}
		if (typeof configFn === 'string') {
			const configFnStr = configFn; // String pointer.
			configFn = async (): Promise<CMDConfigFnRtns> => configFnStr;
		}
		if (configFn instanceof Array) {
			const configFnArr = configFn; // Array pointer.
			configFn = async (): Promise<CMDConfigFnRtns> =>
				configFnArr.map((cmd) => {
					if (typeof cmd !== 'string' && typeof cmd !== 'function') {
						throw new Error('`' + this.cmdName + '` command has an invalid data type.');
					}
					return cmd; // Strings and are nice.
				});
		} else if (configFn && typeof configFn === 'object') {
			const configFnObj = configFn; // Object pointer.
			configFn = async (): Promise<CMDConfigFnRtns> => configFnObj;
		}
		if (null === configFn) {
			throw new Error('`' + this.cmdName + '` command is unavailable.');
		}
		if (typeof configFn !== 'function') {
			throw new Error('`' + this.cmdName + '` command has an invalid data type.');
		}
		if (configFn.constructor.name !== 'AsyncFunction') {
			const configFnSync = configFn; // Function pointer.
			configFn = async (...args): Promise<CMDConfigFnRtns> => (configFnSync as unknown as CMDConfigFnSync)(...args);
		}
		return configFn as CMDConfigFn;
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

		if (null === configFn && this.cmdName.startsWith('on::')) {
			return { env: {}, cmds: [], opts: {} }; // Event w/ no listener.
		} else if (null === configFn) {
			throw new Error('`' + this.cmdName + '` command is unavailable.');
		}
		let configFnRtn = await configFn(this.cmdArgs, ctxUtils);

		configFnRtn = configFnRtn instanceof Array ? { cmds: configFnRtn } : configFnRtn;
		configFnRtn = typeof configFnRtn === 'function' ? { cmds: [configFnRtn] } : configFnRtn;
		configFnRtn = typeof configFnRtn === 'string' ? { cmds: '' === configFnRtn ? [] : [configFnRtn] } : configFnRtn;

		if (null === configFnRtn || typeof configFnRtn !== 'object') {
			throw new Error('`' + this.cmdName + '` command config has an invalid data type.');
		}
		configFnRtn = Object.assign({ env: {}, cmds: [], opts: {} }, configFnRtn);
		(configFnRtn.env = configFnRtn.env || {}), (configFnRtn.opts = configFnRtn.opts || {});
		configFnRtn.cmds = typeof configFnRtn.cmds === 'function' ? [configFnRtn.cmds] : configFnRtn.cmds;
		configFnRtn.cmds = typeof configFnRtn.cmds === 'string' ? ('' === configFnRtn.cmds ? [] : [configFnRtn.cmds]) : configFnRtn.cmds;

		if (null === configFnRtn.env || typeof configFnRtn.env !== 'object') {
			throw new Error('`' + this.cmdName + '` command config contains invalid data for derived `env` property.');
		}
		if (!(configFnRtn.cmds instanceof Array) || !configFnRtn.cmds.length) {
			throw new Error('`' + this.cmdName + '` command config contains invalid data for derived `cmds` property.');
		}
		if (null === configFnRtn.opts || typeof configFnRtn.opts !== 'object') {
			throw new Error('`' + this.cmdName + '` command config contains invalid data for derived `opts` property.');
		}
		for (let i = 0; i < configFnRtn.cmds.length; i++) {
			let cmdData = configFnRtn.cmds[i];
			cmdData = typeof cmdData === 'string' ? { cmd: cmdData } : cmdData;
			cmdData = typeof cmdData === 'function' ? { cmd: cmdData } : cmdData;

			if (null === cmdData || typeof cmdData !== 'object') {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with an invalid data type.');
			}
			cmdData = Object.assign({ cmd: '' }, { env: configFnRtn.env, opts: configFnRtn.opts }, cmdData);
			(cmdData.env = cmdData.env || {}), (cmdData.opts = cmdData.opts || {}); // Catch empty values.
			configFnRtn.cmds[i] = cmdData; // Update config data object now with merged/massaged data.

			if (null === cmdData.env || typeof cmdData.env !== 'object') {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with invalid data for its derived `env` property.');
			}
			if ((typeof cmdData.cmd !== 'string' && typeof cmdData.cmd !== 'function') || !cmdData.cmd) {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with invalid data for its derived `cmd` property.');
			}
			if (typeof cmdData.cmd === 'function' && cmdData.cmd.constructor.name !== 'AsyncFunction') {
				const cmdFnSync = cmdData.cmd; // Function pointer.
				cmdData.cmd = async (...args): Promise<void> => (cmdFnSync as unknown as CMDFnSync)(...args);
			}
			if (null === cmdData.opts || typeof cmdData.opts !== 'object') {
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
			const escREPos = u.escRegExp(pos);

			const argValue = se.quote(String(v));
			// Both formats supported for consistency, but always populated by value.

			const regExpArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escREPos + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
			const regExpArgValue = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escREPos + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu');

			cmd = cmd.replace(regExpArgParts, argValue).replace(regExpArgValue, argValue);
		});
		for (const [n, v] of Object.entries(_ꓺomit(this.cmdArgs, omitFromNamedCMDArgs))) {
			if (typeof v === 'boolean' && false === v) {
				continue; // Not applicable.
			}
			const prefix = '-'.repeat(1 === n.length ? 1 : 2);
			const escREName = u.escRegExp(prefix + n);

			const argValue = typeof v === 'boolean' ? '' : se.quote(String(v));
			const argParts = se.quote(prefix + n) + (argValue.length ? ' ' + argValue : '');

			cmd = cmd.replace(new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escREName + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu'), argParts);
			cmd = cmd.replace(new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escREName + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu'), argValue);
		}
		cmd = cmd.replace(regexAllCMDArgPartsValues, (/* All arguments. Both formats supported for consistency. */) => {
			const args = []; // Initialize list of arguments.

			for (const v of this.cmdArgs._ as Array<string | number>) {
				args.push(String(v)); // Positional argument.
			}
			for (const [n, v] of Object.entries(_ꓺomit(this.cmdArgs, omitFromNamedCMDArgs))) {
				if (typeof v === 'boolean' && false === v) {
					continue; // Not applicable.
				}
				const prefix = '-'.repeat(1 === n.length ? 1 : 2);
				const name = prefix + n;

				args.push(name); // Named argument.
				typeof v === 'boolean' ? null : args.push(String(v));
			}
			return se.quoteAll(args).join(' ');
		});
		// Empty any others remaining; i.e., that were not already filled above.
		cmd = cmd.replace(regexpRemainingCMDArgParts, '').replace(regexpRemainingCMDArgValues, '');

		// Finally, compress any superfluous whitespace left behind by replacements.
		return cmd.replace(/[\t ]+/gu, ' ').trim();
	}
}
