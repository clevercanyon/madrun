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
import type { AllArgs as uꓺAllArgs, Args as uꓺArgs } from '../utilities.js';

import { escRegExp as $strꓺescRegExp } from '@clevercanyon/utilities/str';
import { exec as $cmdꓺexec, spawn as $cmdꓺspawn, quote as $cmdꓺquote, quoteAll as $cmdꓺquoteAll } from '@clevercanyon/utilities.node/cmd';

/**
 * Types/interfaces.
 */

/**
 * Outer config file contents.
 *
 * Example:
 *
 *      export default {
 *          'build'   => 'npx vite build',
 *          'preview' => 'npx vite preview',
 *      }
 *
 * Example:
 *
 *      export default async ({cmd, args, ctx}) => {
 *          return {
 *              'build'   => 'npx vite build',
 *              'preview' => 'npx vite preview',
 *          };
 *      }
 */

export type Config = ConfigFnRtns | ConfigFn | ConfigFnSync;
export type ConfigFn = (madrun: Props) => Promise<ConfigFnRtns>;
export type ConfigFnSync = (madrun: Props) => ConfigFnRtns;
export type ConfigFnRtns = { [x: string]: CMDConfig };

/**
 * Inner CMD configurations.
 *
 * Examples:
 *
 *      {
 *          'build'      => './path/to/build.js {{@}}',
 *          'build:prod' => './path/to/build.js --mode=prod',
 *
 *          'dev'   => [ // Triggers multiple CMDs.
 *
 *                         './path/to/build.js --mode=dev',
 *                         ({cmd, args, ctx}) => { postBuild(); },
 *                         'if [[ -n "${X_FOO}" ]]; then ... fi;',
 *                         './path/to/preview.js --mode=dev',
 *           ],
 *
 *          'install'  => { // Triggers multiple carefully crafted CMDs.
 *              env: {
 *                  USERNAME     => 'xxxxxxxxxxxx',
 *                  ACCESS_TOKEN => 'xxxxxxxxxxxx',
 *              },
 *              opts: {
 *                  quiet: true,
 *              },
 *              cmds: [
 *                  './pre-install.js',
 *                  ({cmd, args, ctx}) => { preInstall(); },
 *                  { opts: { quiet: false }, cmd: 'npm install' },
 *                  { opts: { quiet: false }, cmd: ({cmd, args, ctx}) => { postInstall(); } },
 *                  { env: { SECRET_TOKEN: 'xxxxxx' }, opts: { quiet: false }, cmd: 'npx command args' },
 *              ],
 *           },
 *
 *           'acp' => ({cmd, args, ctx}) => {
 *               return 'git add --all && git commit -m "Update." && git push';
 *           },
 *
 *           'publish' => async ({cmd, args, ctx}) => {
 *               if ( args.tag ) {
 *                   return [ 'nmp version patch', 'npm publish', () => { tagRelease(); } ];
 *               } else {
 *                   return [ 'nmp version patch', 'npm publish' ];
 *               }
 *           },
 *
 *           'ci' => async ({cmd, args, ctx}) => {
 *               return {
 *                   env: {
 *                       USERNAME     => 'xxxxxxxxxxxx',
 *                       ACCESS_TOKEN => 'xxxxxxxxxxxx',
 *                   },
 *                   cmds: [ 'npm install', 'npm test' ],
 *               };
 *           },
 *
 *           'test' => async ({cmd, args, ctx}) => {
 *               return () => { args.ux ? runUXTests() : runAllTests() };
 *           },
 *      }
 */

export type CMDConfig = string | Array<string | CMDFn | CMDFnSync> | CMDConfigObj | CMDConfigFn | CMDConfigFnSync;
export type CMDConfigFn = (madrun: Props) => Promise<CMDConfigFnRtns>;
export type CMDConfigFnSync = (madrun: Props) => CMDConfigFnRtns;
export type CMDConfigFnRtns = string | CMDFn | CMDFnSync | Array<string | CMDFn | CMDFnSync> | CMDConfigObj;

export type CMDConfigObj = { env?: Env; opts?: Opts; cmds: CMDConfigObjCMDs };
export type CMDConfigObjCMDs = string | CMDFn | CMDFnSync | CMDSingleConfigObj | Array<string | CMDFn | CMDFnSync | CMDSingleConfigObj>;
export type CMDSingleConfigObj = { env?: Env; opts?: Opts; cmd: string | CMDFn | CMDFnSync };

export type CMDFn = (madrun: Props) => Promise<CMDFnRtns>;
export type CMDFnSync = (madrun: Props) => CMDFnRtns;
export type CMDFnRtns = void;

/**
 * Structured (i.e., fully resolved).
 */

export type StructuredCMDConfigData = { env: Env; opts: Opts; cmds: CMDs };

export type Env = { [x: string]: unknown };
export type Opts = { [x: string]: unknown };
export type CMDs = Array<{ env: Env; opts: Opts; cmd: string | CMDFn }>;

export type CMD = string; // Formality.
export type Args = uꓺArgs; // From utilities.
export type Ctx = { cwd: string; env: Env; opts: Opts };
export type Props = { cmd: CMD; args: Args; ctx: Ctx };

/**
 * Run command.
 */
export default class Run {
	/**
	 * All Yargs args.
	 */
	protected allArgs: uꓺAllArgs;

	/**
	 * Called CMD name.
	 */
	protected cmd: CMD;

	/**
	 * Called CMD args.
	 */
	protected args: Args;

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
	public constructor(args: uꓺAllArgs) {
		this.allArgs = args;

		this.cmd = String(args._?.[0] || '');
		this.args = {
			_: args._.slice(1),
			..._ꓺomit(args, u.omitFromNamedArgs),
		};
		if ('' === this.cmd) {
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
		if (this.allArgs.madrunDebug) {
			console.debug(chalk.black('cwd:') + ' ' + chalk.gray(this.cwd));
			console.debug(chalk.black('args:') + ' ' + chalk.gray(JSON.stringify(this.allArgs, null, 4)));
			console.debug(chalk.black('configFile:') + ' ' + chalk.gray(this.configFile));
			console.debug(chalk.black('---'));

			console.debug(chalk.black('cmdName:') + ' ' + chalk.gray(this.cmd));
			console.debug(chalk.black('cmdArgs:') + ' ' + chalk.gray(JSON.stringify(this.args, null, 4)));
			console.debug(chalk.black('---'));
		}
	}

	/**
	 * Runs CMD.
	 */
	public async run(): Promise<void> {
		await this.maybeInstallPackageDependencies();
		const cmdConfigData = await this.structuredCMDConfigData();

		for (const cmdData of cmdConfigData.cmds) {
			if (typeof cmdData.cmd === 'function') {
				// Propagates env vars in given CMD.
				await this.propagateCMD(cmdData.env);

				if (this.allArgs.madrunDebug) {
					console.debug(chalk.black('rawEnv:') + ' ' + chalk.gray(JSON.stringify(cmdData.env, null, 4)));
					console.debug(chalk.black('rawOpts:') + ' ' + chalk.gray(JSON.stringify(cmdData.opts, null, 4)));
					console.debug(chalk.black('rawCMD:') + ' ' + chalk.gray('[function]')); // Function CMD.
					console.debug(chalk.black('cmd:') + ' ' + chalk.gray('[function]')); // Function CMD.
					console.debug(chalk.black('---'));
				}
				await cmdData.cmd({ cmd: this.cmd, args: this.args, ctx: { ...this.ctx, env: cmdData.env, opts: cmdData.opts } });
			} else {
				// Populates env vars & replacement codes in given CMD.
				const cmd = await this.populateCMD(cmdData.env, cmdData.cmd);

				if (this.allArgs.madrunDebug) {
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

		if (this.allArgs.madrunDebug) {
			console.debug(chalk.black('Auto-installing NPM package dependencies.'));
			console.debug(chalk.black('---'));
		}
		await $cmdꓺspawn('npm', canInstallClean ? ['ci'] : ['install'], { cwd: this.cwd });
	}

	/**
	 * Gets configuration.
	 *
	 * @returns Configuration; else `null` for events w/o a listener.
	 *
	 * @throws  Error if anything unexpected occurs.
	 */
	protected async config(): Promise<Config | null> {
		let config = null; // Initialize.

		if ('default' === this.configFile) {
			config = (await import('../../../default.js')).default as Config;
			//
		} else if (this.configFile.endsWith('.json')) {
			config = (await import(this.configFile, { assert: { type: 'json' } })) as Config;
			//
		} else if (this.configFile) {
			config = ((await import(this.configFile)) as { default: unknown }).default as Config;
		}
		if (null === config && this.cmd.startsWith('on::')) {
			return null; // Event w/o a listener.
		} else if (null === config /* Cannot be null otherwise. */) {
			throw new Error('`' + path.basename(this.configFile) + '` config failure.');
		}
		if (typeof config !== 'object' && typeof config !== 'function') {
			throw new Error('`' + path.basename(this.configFile) + '` config failure.');
		}
		return config;
	}

	/**
	 * Gets config function.
	 *
	 * @returns Config function; else `null` for events w/o a listener.
	 */
	protected async configFn(): Promise<ConfigFn | ConfigFnSync | null> {
		let config = await this.config();

		if (null === config && this.cmd.startsWith('on::')) {
			return null; // Event w/o a listener.
		}
		if (null === config /* Cannot be null otherwise. */) {
			throw new Error('`' + path.basename(this.configFile) + '` config failure.');
		}
		if (typeof config === 'object') {
			const configObj = config; // Object pointer.
			config = async (): Promise<ConfigFnRtns> => configObj;
		}
		if (null === config && this.cmd.startsWith('on::')) {
			return null; // Event w/o a listener.
		} else if (null === config /* Cannot be null otherwise. */) {
			throw new Error('`' + path.basename(this.configFile) + '` config failure.');
		}
		if (typeof config !== 'function') {
			throw new Error('`' + path.basename(this.configFile) + '` config failure.');
		}
		return config; // As function.
	}

	/**
	 * Gets CMD config for current `cmdName`.
	 *
	 * @returns CMD config; else `null` for events w/o a listener.
	 */
	protected async cmdConfig(): Promise<CMDConfig | null> {
		const configFn = await this.configFn();

		if (null === configFn && this.cmd.startsWith('on::')) {
			return null; // Event w/o a listener.
		} else if (null === configFn /* Cannot be null otherwise. */) {
			throw new Error('`' + path.basename(this.configFile) + '` config failure.');
		}
		const cmdConfigs = await configFn({ cmd: this.cmd, args: this.args, ctx: this.ctx });
		const cmdConfig = cmdConfigs[this.cmd] || null; // By CMD name.

		if (null === cmdConfig && this.cmd.startsWith('on::')) {
			return null; // Event w/o a listener.
		} else if (null === cmdConfig /* Cannot be null otherwise. */) {
			throw new Error('`' + this.cmd + '` command is unavailable.');
		}
		return cmdConfig;
	}

	/**
	 * Gets CMD config function for current `cmdName`.
	 *
	 * @returns CMD config function; else `null` for events w/o a listener.
	 */
	protected async cmdConfigFn(): Promise<CMDConfigFn | CMDConfigFnSync | null> {
		let cmdConfig = await this.cmdConfig();

		if (null === cmdConfig && this.cmd.startsWith('on::')) {
			return null; // Event w/o a listener.
		} else if (null === cmdConfig /* Cannot be null otherwise. */) {
			throw new Error('`' + this.cmd + '` command is unavailable.');
		}
		if (typeof cmdConfig === 'string') {
			const cmdConfigStr = cmdConfig; // String pointer.
			cmdConfig = async (): Promise<CMDConfigFnRtns> => cmdConfigStr;
			//
		} else if (cmdConfig instanceof Array) {
			const cmdConfigArr = cmdConfig; // Array pointer.
			cmdConfig = async (): Promise<CMDConfigFnRtns> => cmdConfigArr;
			//
		} else if (typeof cmdConfig === 'object') {
			const cmdConfigObj = cmdConfig; // Object pointer.
			cmdConfig = async (): Promise<CMDConfigFnRtns> => cmdConfigObj;
		}
		if (null === cmdConfig && this.cmd.startsWith('on::')) {
			return null; // Event w/o a listener.
		} else if (null === cmdConfig /* Cannot be null otherwise. */) {
			throw new Error('`' + this.cmd + '` command is unavailable.');
		}
		if (typeof cmdConfig !== 'function') {
			throw new Error('`' + this.cmd + '` command has an invalid data type.');
		}
		return cmdConfig; // As function.
	}

	/**
	 * Gets structured config data for current `cmdName`.
	 *
	 * @returns Structured CMD config data.
	 */
	protected async structuredCMDConfigData(): Promise<StructuredCMDConfigData> {
		const cmdConfigFn = await this.cmdConfigFn();

		if (null === cmdConfigFn && this.cmd.startsWith('on::')) {
			return { env: {}, opts: {}, cmds: [] }; // Event w/o a listener.
		} else if (null === cmdConfigFn /* Cannot be null otherwise. */) {
			throw new Error('`' + this.cmd + '` command is unavailable.');
		}
		let cmdConfigData = await cmdConfigFn({ cmd: this.cmd, args: this.args, ctx: this.ctx });

		cmdConfigData = typeof cmdConfigData === 'string' ? { cmds: '' === cmdConfigData ? [] : [cmdConfigData] } : cmdConfigData;
		cmdConfigData = cmdConfigData instanceof Array /* Array object. */ ? { cmds: cmdConfigData } : cmdConfigData;
		cmdConfigData = typeof cmdConfigData === 'function' ? { cmds: [cmdConfigData] } : cmdConfigData;

		if (null === cmdConfigData || typeof cmdConfigData !== 'object') {
			throw new Error('`' + this.cmd + '` command config has an invalid data type.');
		}
		cmdConfigData = Object.assign({ env: {}, opts: {}, cmds: [] }, cmdConfigData);
		(cmdConfigData.env = cmdConfigData.env || {}), (cmdConfigData.opts = cmdConfigData.opts || {});

		cmdConfigData.cmds = typeof cmdConfigData.cmds === 'string' ? ('' === cmdConfigData.cmds ? [] : [cmdConfigData.cmds]) : cmdConfigData.cmds;
		cmdConfigData.cmds = typeof cmdConfigData.cmds === 'function' ? [cmdConfigData.cmds] : cmdConfigData.cmds;
		cmdConfigData.cmds = typeof cmdConfigData.cmds === 'object' ? [cmdConfigData.cmds as CMDSingleConfigObj] : cmdConfigData.cmds;

		if (null === cmdConfigData.env || typeof cmdConfigData.env !== 'object') {
			throw new Error('`' + this.cmd + '` command config contains invalid data for derived `env` property.');
		}
		if (null === cmdConfigData.opts || typeof cmdConfigData.opts !== 'object') {
			throw new Error('`' + this.cmd + '` command config contains invalid data for derived `opts` property.');
		}
		if (null === cmdConfigData.cmds || !(cmdConfigData.cmds instanceof Array) || !cmdConfigData.cmds.length) {
			throw new Error('`' + this.cmd + '` command config contains invalid data for derived `cmds` property.');
		}
		for (let i = 0; i < cmdConfigData.cmds.length; i++) {
			let cmdData = cmdConfigData.cmds[i];

			cmdData = typeof cmdData === 'string' ? { cmd: cmdData } : cmdData;
			cmdData = typeof cmdData === 'function' ? { cmd: cmdData } : cmdData;

			if (null === cmdData || typeof cmdData !== 'object') {
				throw new Error('`' + this.cmd + '` command config contains a CMD with an invalid data type.');
			}
			cmdData = Object.assign({ env: { ...cmdConfigData.env }, opts: { ...cmdConfigData.opts }, cmd: '' }, cmdData);
			(cmdData.env = cmdData.env || {}), (cmdData.opts = cmdData.opts || {});

			if (null === cmdData.env || typeof cmdData.env !== 'object') {
				throw new Error('`' + this.cmd + '` command config contains a CMD with invalid data for its derived `env` property.');
			}
			if (null === cmdData.opts || typeof cmdData.opts !== 'object') {
				throw new Error('`' + this.cmd + '` command config contains a CMD with invalid data for its derived `opts` property.');
			}
			if ((typeof cmdData.cmd !== 'string' && typeof cmdData.cmd !== 'function') || !cmdData.cmd) {
				throw new Error('`' + this.cmd + '` command config contains a CMD with invalid data for its derived `cmd` property.');
			}
			cmdConfigData.cmds[i] = cmdData; // Update.
		}
		return cmdConfigData as StructuredCMDConfigData;
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
		(this.args._ as Array<string | number>).forEach((v, i) => {
			const position = String(i + 1);
			const escRegExpPosition = $strꓺescRegExp(position);
			const quotedArgValue = $cmdꓺquote(String(v));

			const regExpArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escRegExpPosition + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
			const regExpArgValue = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escRegExpPosition + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu');

			cmd = cmd.replace(regExpArgParts, quotedArgValue);
			cmd = cmd.replace(regExpArgValue, quotedArgValue);
		});
		for (const [n, v] of Object.entries(_ꓺomit(this.args, u.omitFromNamedArgs))) {
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

			for (const v of this.args._ as Array<string | number>) {
				args.push(String(v)); // Positional argument.
			}
			for (const [n, v] of Object.entries(_ꓺomit(this.args, u.omitFromNamedArgs))) {
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
