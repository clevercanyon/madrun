#!/usr/bin/env node
/**
 * Run command.
 */

import fs from 'node:fs';
import path from 'node:path';
import { findUpSync } from 'find-up';

import chalk from 'chalk';
import _ꓺomit from 'lodash/omit.js';

import * as u from '../utilities.js';
import type { Args, CMDArgs } from '../utilities.js';

import { escRegExp as $strꓺescRegExp } from '@clevercanyon/utilities/str';
import { exec as $cmdꓺexec, spawn as $cmdꓺspawn, quote as $cmdꓺquote, quoteAll as $cmdꓺquoteAll } from '@clevercanyon/utilities.node/cmd';

/**
 * Types/interfaces.
 */

export interface Env {
	[x: string]: unknown;
}
export interface Opts {
	[x: string]: unknown;
}
export interface Ctx {
	cwd: string;
	env: Env;
	opts: Opts;
}
export type CMDs =
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

export interface Config {
	[x: string]:
		| string
		| CMDConfigFn
		| CMDConfigFnSync
		| Array<string | CMDFn | CMDFnSync>
		| {
				env?: Env;
				opts?: Opts;
				cmds: CMDs;
		  };
}
export type CMDConfigFn = (cmdArgs: CMDArgs, ctxUtils: Ctx) => Promise<CMDConfigFnRtns>;
export type CMDConfigFnSync = (cmdArgs: CMDArgs, ctxUtils: Ctx) => CMDConfigFnRtns;
export type CMDConfigFnRtns = string | CMDFn | CMDFnSync | Array<string | CMDFn | CMDFnSync> | { env?: Env; opts?: Opts; cmds: CMDs };

export type CMDFn = (cmdArgs: CMDArgs, ctxUtils: Ctx) => Promise<void>;
export type CMDFnSync = (cmdArgs: CMDArgs, ctxUtils: Ctx) => void;

export interface CMDConfigData {
	env: Env;
	opts: Opts;
	cmds: Array<{
		env: Env;
		opts: Opts;
		cmd: string | CMDFn;
	}>;
}

/**
 * Run command.
 */
export default class Run {
	/**
	 * Yargs args.
	 */
	protected args: Args;

	/**
	 * Called CMD name.
	 */
	protected cmdName: string;

	/**
	 * Called CMD args.
	 */
	protected cmdArgs: CMDArgs;

	/**
	 * Config file location.
	 */
	protected configFile: string;

	/**
	 * Config file directory as CWD.
	 */
	protected cwd: string;

	/**
	 * Contextual data.
	 */
	protected ctx: Ctx;

	/**
	 * Constructor.
	 */
	public constructor(args: Args) {
		this.args = args;

		this.cmdName = String(args._?.[0] || '');
		this.cmdArgs = {
			_: args._.slice(1),
			..._ꓺomit(args, u.omitFromNamedCMDArgs),
		};
		if ('' === this.cmdName) {
			throw new Error('Missing command name.');
		}
		const foundConfigFile = findUpSync(u.configFiles);

		if (foundConfigFile) {
			this.configFile = foundConfigFile;
			this.cwd = path.dirname(this.configFile);
		} else {
			this.cwd = process.cwd();
			this.configFile = 'default';
		}
		this.ctx = {
			cwd: this.cwd, // CWD.
			env: {}, // Populated for CMDs.
			opts: {}, // Populated for CMDs.
		};
		if (this.args.madrunDebug) {
			console.debug(chalk.black('cwd:') + ' ' + chalk.gray(this.cwd));
			console.debug(chalk.black('args:') + ' ' + chalk.gray(JSON.stringify(this.args, null, 4)));
			console.debug(chalk.black('configFile:') + ' ' + chalk.gray(this.configFile));
			console.debug(chalk.black('---'));

			console.debug(chalk.black('cmdName:') + ' ' + chalk.gray(this.cmdName));
			console.debug(chalk.black('cmdArgs:') + ' ' + chalk.gray(JSON.stringify(this.cmdArgs, null, 4)));
			console.debug(chalk.black('---'));
		}
	}

	/**
	 * Runs CMD.
	 */
	public async run(): Promise<void> {
		await this.maybeInstallPackageDependencies();
		const cmdConfigData = await this.cmdConfigData();

		for (const cmdData of cmdConfigData.cmds) {
			if (typeof cmdData.cmd === 'function') {
				// Propagates env vars in given CMD.
				await this.propagateCMD(cmdData.env);

				if (this.args.madrunDebug) {
					console.debug(chalk.black('rawEnv:') + ' ' + chalk.gray(JSON.stringify(cmdData.env, null, 4)));
					console.debug(chalk.black('rawOpts:') + ' ' + chalk.gray(JSON.stringify(cmdData.opts, null, 4)));
					console.debug(chalk.black('rawCMD:') + ' ' + chalk.gray('[function]')); // Function CMD.
					console.debug(chalk.black('cmd:') + ' ' + chalk.gray('[function]')); // Function CMD.
					console.debug(chalk.black('---'));
				}
				await cmdData.cmd(this.cmdArgs, { ...this.ctx, env: cmdData.env, opts: cmdData.opts });
			} else {
				// Populates env vars & replacement codes in given CMD.
				const cmd = await this.populateCMD(cmdData.env, cmdData.cmd);

				if (this.args.madrunDebug) {
					console.debug(chalk.black('rawEnv:') + ' ' + chalk.gray(JSON.stringify(cmdData.env, null, 4)));
					console.debug(chalk.black('rawOpts:') + ' ' + chalk.gray(JSON.stringify(cmdData.opts, null, 4)));
					console.debug(chalk.black('rawCMD:') + ' ' + chalk.gray(cmdData.cmd)); // String CMD.
					console.debug(chalk.black('cmd:') + ' ' + chalk.gray(cmd));
					console.debug(chalk.black('---'));
				}
				await $cmdꓺexec(cmd, { cwd: this.cwd, ...cmdData.opts });
			}
		}
	}

	/**
	 * Installs project’s package dependencies; maybe.
	 */
	protected async maybeInstallPackageDependencies(): Promise<void> {
		const pkgFile = path.resolve(this.cwd, './package.json');
		const nodeModulesDir = path.resolve(this.cwd, './node_modules');

		if (!fs.existsSync(pkgFile) || fs.existsSync(nodeModulesDir)) {
			return; // Nothing to do in these cases.
		}
		const pkgLockFile = path.resolve(this.cwd, './package-lock.json');
		const npmShrinkwrapFile = path.resolve(this.cwd, './npm-shrinkwrap.json');
		const canInstallClean = fs.existsSync(pkgLockFile) || fs.existsSync(npmShrinkwrapFile);

		if (this.args.madrunDebug) {
			console.debug(chalk.black('Auto-installing NPM package dependencies.'));
			console.debug(chalk.black('---'));
		}
		await $cmdꓺspawn('npm', canInstallClean ? ['ci'] : ['install'], { cwd: this.cwd });
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
			//
		} else if (this.configFile.endsWith('.json')) {
			config = (await import(configFile, { assert: { type: 'json' } })) as Config;
		} else {
			config = ((await import(configFile)) as { default: unknown }).default as Config;
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
		const configFn = await this.cmdConfigFn();

		if (null === configFn && this.cmdName.startsWith('on::')) {
			return { env: {}, opts: {}, cmds: [] }; // Event w/ no listener.
		} else if (null === configFn) {
			throw new Error('`' + this.cmdName + '` command is unavailable.');
		}
		let configFnRtn = await configFn(this.cmdArgs, this.ctx);

		configFnRtn = configFnRtn instanceof Array ? { cmds: configFnRtn } : configFnRtn;
		configFnRtn = typeof configFnRtn === 'function' ? { cmds: [configFnRtn] } : configFnRtn;
		configFnRtn = typeof configFnRtn === 'string' ? { cmds: '' === configFnRtn ? [] : [configFnRtn] } : configFnRtn;

		if (null === configFnRtn || typeof configFnRtn !== 'object') {
			throw new Error('`' + this.cmdName + '` command config has an invalid data type.');
		}
		configFnRtn = Object.assign({ env: {}, opts: {}, cmds: [] }, configFnRtn);
		(configFnRtn.env = configFnRtn.env || {}), (configFnRtn.opts = configFnRtn.opts || {});
		configFnRtn.cmds = typeof configFnRtn.cmds === 'function' ? [configFnRtn.cmds] : configFnRtn.cmds;
		configFnRtn.cmds = typeof configFnRtn.cmds === 'string' ? ('' === configFnRtn.cmds ? [] : [configFnRtn.cmds]) : configFnRtn.cmds;

		if (null === configFnRtn.env || typeof configFnRtn.env !== 'object') {
			throw new Error('`' + this.cmdName + '` command config contains invalid data for derived `env` property.');
		}
		if (null === configFnRtn.opts || typeof configFnRtn.opts !== 'object') {
			throw new Error('`' + this.cmdName + '` command config contains invalid data for derived `opts` property.');
		}
		if (!(configFnRtn.cmds instanceof Array) || !configFnRtn.cmds.length) {
			throw new Error('`' + this.cmdName + '` command config contains invalid data for derived `cmds` property.');
		}
		for (let i = 0; i < configFnRtn.cmds.length; i++) {
			let cmdData = configFnRtn.cmds[i];

			cmdData = typeof cmdData === 'string' ? { cmd: cmdData } : cmdData;
			cmdData = typeof cmdData === 'function' ? { cmd: cmdData } : cmdData;

			if (null === cmdData || typeof cmdData !== 'object') {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with an invalid data type.');
			}
			cmdData = Object.assign({ env: configFnRtn.env, opts: configFnRtn.opts, cmd: '' }, cmdData);
			(cmdData.env = cmdData.env || {}), (cmdData.opts = cmdData.opts || {});

			if (null === cmdData.env || typeof cmdData.env !== 'object') {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with invalid data for its derived `env` property.');
			}
			if (null === cmdData.opts || typeof cmdData.opts !== 'object') {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with invalid data for its derived `opts` property.');
			}
			if ((typeof cmdData.cmd !== 'string' && typeof cmdData.cmd !== 'function') || !cmdData.cmd) {
				throw new Error('`' + this.cmdName + '` command config contains a CMD with invalid data for its derived `cmd` property.');
			}
			if (typeof cmdData.cmd === 'function' && cmdData.cmd.constructor.name !== 'AsyncFunction') {
				const cmdFnSync = cmdData.cmd; // Function pointer.
				cmdData.cmd = async (...args): Promise<void> => (cmdFnSync as unknown as CMDFnSync)(...args);
			}
			configFnRtn.cmds[i] = cmdData; // Update.
		}
		return configFnRtn as CMDConfigData;
	}

	/**
	 * Propagates a given CMD env.
	 *
	 * @param env Environment vars.
	 */
	protected async propagateCMD(env: Env): Promise<void> {
		for (const [name, value] of Object.entries(env)) {
			process.env[name] = String(value);
		}
	}

	/**
	 * Populates a given CMD env + CMD + any args.
	 *
	 * @param   env CMD environment vars.
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

		const maybeQuote = (v: string): string => {
			if (v.startsWith("'") && v.endsWith("'")) {
				return v; // Quoted already.
			}
			if (v.startsWith('"') && v.endsWith('"')) {
				return v; // Quoted already.
			}
			return $cmdꓺquote(v);
		};
		for (const [name, value] of Object.entries(env)) {
			vars += ' export ' + name + '=' + maybeQuote(String(value)) + ';';
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
			const position = String(i + 1);
			const escRegExpPosition = $strꓺescRegExp(position);
			const quotedArgValue = $cmdꓺquote(String(v));

			const regExpArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escRegExpPosition + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
			const regExpArgValue = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escRegExpPosition + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu');

			cmd = cmd.replace(regExpArgParts, quotedArgValue);
			cmd = cmd.replace(regExpArgValue, quotedArgValue);
		});
		for (const [n, v] of Object.entries(_ꓺomit(this.cmdArgs, u.omitFromNamedCMDArgs))) {
			if (typeof v === 'boolean' && false === v) {
				continue; // Not applicable.
			}
			const argPrefixedName = '-'.repeat(1 === n.length ? 1 : 2) + n;
			const escRegExpArgPrefixedName = $strꓺescRegExp(argPrefixedName);

			const quotedArgValues = typeof v === 'boolean' ? ''
					: v instanceof Array && n.endsWith('[') ? $cmdꓺquoteAll(v.concat(']').map((v) => String(v))).join(' ')
					: v instanceof Array ? $cmdꓺquoteAll(v.map((v) => String(v))).join(' ')
					: $cmdꓺquote(String(v)); // prettier-ignore

			const quotedArgParts = $cmdꓺquote(argPrefixedName) //
				+ (typeof v === 'boolean' ? '' : ' ' + quotedArgValues); // prettier-ignore

			const regExpArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escRegExpArgPrefixedName + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
			const regExpArgValues = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escRegExpArgPrefixedName + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu');

			cmd = cmd.replace(regExpArgParts, quotedArgParts);
			cmd = cmd.replace(regExpArgValues, quotedArgValues);
		}
		cmd = cmd.replace(this.regexAllCMDArgPartsValues, (/* All arguments. */) => {
			let args = []; // Initialize list of arguments.

			for (const v of this.cmdArgs._ as Array<string | number>) {
				args.push(String(v)); // Positional argument.
			}
			for (const [n, v] of Object.entries(_ꓺomit(this.cmdArgs, u.omitFromNamedCMDArgs))) {
				if (typeof v === 'boolean' && false === v) {
					continue; // Not applicable.
				}
				const argPrefixedName = '-'.repeat(1 === n.length ? 1 : 2) + n;

				const argValues = typeof v === 'boolean' ? []
					: v instanceof Array && n.endsWith('[')  ? v.concat(']').map((v) => String(v))
					: v instanceof Array ? v.map((v) => String(v))
					: [String(v)]; // prettier-ignore

				args.push(argPrefixedName);
				args = args.concat(argValues);
			}
			return $cmdꓺquoteAll(args).join(' ');
		});
		// Empty any others remaining; i.e., that were not already filled above.
		cmd = cmd.replace(this.regexpRemainingCMDArgParts, '').replace(this.regexpRemainingCMDArgValues, '');

		// Finally, compress any superfluous whitespace left behind by replacements.
		return cmd.replace(/[\t ]+/gu, ' ').trim();
	}

	/**
	 * Caches frequently used regular expressions.
	 */
	protected regexAllCMDArgPartsValues = new RegExp('\\$\\{{1}@\\}{1}|\\{{2}@\\}{2}', 'gu'); // Both formats.
	protected regexpRemainingCMDArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
	protected regexpRemainingCMDArgValues = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{1}', 'gu');
}
