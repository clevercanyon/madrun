#!/usr/bin/env node
/**
 * Run command.
 */

import { $is, $json, $obj, $str } from '@clevercanyon/utilities';
import { $chalk, $cmd, $fs } from '@clevercanyon/utilities.node';
import fs from 'node:fs';
import path from 'node:path';
import * as u from '../utilities.ts';

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
 *          'build': './path/to/build.js {{@}}',
 *          'build:prod': './path/to/build.js --mode=prod',
 *
 *          'dev': [ // Triggers multiple CMDs.
 *              './path/to/build.js --mode=dev',
 *              ({ cmd, args, ctx }) => { postBuild(); },
 *              'if [[ -n "${X_FOO}" ]]; then ... fi;',
 *              './path/to/preview.js --mode=dev',
 *           ],
 *
 *          'install': { // Triggers multiple carefully crafted CMDs.
 *              env: {
 *                  USERNAME: 'xxxxxxxxxxxx',
 *                  ACCESS_TOKEN: 'xxxxxxxxxxxx',
 *              },
 *              opts: { quiet: true },
 *              cmds: [
 *                  './pre-install.js',
 *                  ['npx', 'update', '--prefer-offline'],
 *                  ({ cmd, args, ctx }) => { preInstall(); },
 *                  { opts: { quiet: false }, cmd: 'npm install' },
 *                  { opts: { quiet: false }, cmd: ({ cmd, args, ctx }) => { postInstall(); } },
 *                  { env: { SECRET_TOKEN: 'xxxxxx' }, opts: { quiet: false }, cmd: 'npx command args' },
 *              ],
 *           },
 *
 *           'acp': ({ cmd, args, ctx }) => {
 *               return 'git add --all && git commit -m "Update." && git push';
 *           },
 *
 *           'publish': async ({ cmd, args, ctx }) => {
 *               if ( args.tag ) {
 *                   return ['nmp version patch', 'npm publish', () => { tagRelease(); }];
 *               } else {
 *                   return ['nmp version patch', 'npm publish'];
 *               }
 *           },
 *
 *           'ci': async ({ cmd, args, ctx }) => {
 *               return {
 *                   env: {
 *                       USERNAME     => 'xxxxxxxxxxxx',
 *                       ACCESS_TOKEN => 'xxxxxxxxxxxx',
 *                   },
 *                   cmds: ['npm ci', ['./run-tests', '--all']],
 *               };
 *           },
 *
 *           'deploy': async ({ cmd, args, ctx }) => {
 *               return {
 *                   env: {
 *                       USERNAME     => 'xxxxxxxxxxxx',
 *                       ACCESS_TOKEN => 'xxxxxxxxxxxx',
 *                   },
 *                   cmds: [
 *                      { env: { FOO: 'foo' }, cmd: 'npm ci' },
 *                      { env: { BAR: 'bar' }, cmd: ['./run-tests', '--all'] },
 *                      { cmd: async () => { const foo = 'foo'; await deploy(foo); },
 *                      { opts: { quiet: true }, cmd: ['post-deploy', '--quiet', 'true'] },
 *                   ],
 *               };
 *           },
 *
 *           'test': async ({ cmd, args, ctx }) => {
 *               return () => { args.ux ? runUXTests() : runAllTests() };
 *           },
 *      }
 */

export type CMDConfig = string | (string | CMDFn | CMDFnSync)[] | CMDConfigObject | CMDConfigFn | CMDConfigFnSync;
export type CMDConfigFn = (madrun: Props) => Promise<CMDConfigFnRtns>;
export type CMDConfigFnSync = (madrun: Props) => CMDConfigFnRtns;
export type CMDConfigFnRtns = string | CMDFn | CMDFnSync | (string | CMDFn | CMDFnSync)[] | CMDConfigObject;

export type CMDConfigObject = { env?: Env; opts?: Opts; cmds: CMDConfigObjectCMDs };
export type CMDConfigObjectCMDs = string | CMDFn | CMDFnSync | CMDSingleConfigObject | (string | string[] | CMDFn | CMDFnSync | CMDSingleConfigObject)[];
export type CMDSingleConfigObject = { env?: Env; opts?: Opts; cmd: string | string[] | CMDFn | CMDFnSync };

export type CMDFn = (madrun: Props) => Promise<CMDFnRtns>;
export type CMDFnSync = (madrun: Props) => CMDFnRtns;
export type CMDFnRtns = void;

/**
 * Structured (i.e., fully resolved).
 */

export type StructuredCMDConfigData = { env: Env; opts: Opts; cmds: CMDs };

export type Env = { [x: string]: unknown };
export type Opts = { [x: string]: unknown };
export type CMDs = { env: Env; opts: Opts; cmd: string | CMDFn }[];

export type CMD = string; // Formality.
export type Args = u.Args; // From utilities.
export type Ctx = { cwd: string; env: Env; opts: Opts };
export type Props = { cmd: CMD; args: Args; ctx: Ctx };

/**
 * Run command.
 */
export default class Run {
    /**
     * All Yargs args.
     */
    protected allArgs: u.AllArgs;

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
    public constructor(args: u.AllArgs) {
        this.allArgs = args;

        this.cmd = String(args._?.[0] || '');
        this.args = {
            _: args._.slice(1),
            ...$obj.omit(args, u.omitFromNamedArgs),
        };
        if ('' === this.cmd) {
            throw new Error('Missing command name.');
        }
        const foundConfigFile = $fs.findUpSync(u.configFiles);

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
            console.debug($chalk.black('cwd:') + ' ' + $chalk.gray(this.cwd));
            console.debug($chalk.black('args:') + ' ' + $chalk.gray($json.stringify(this.allArgs, { pretty: true })));
            console.debug($chalk.black('configFile:') + ' ' + $chalk.gray(this.configFile));
            console.debug($chalk.black('---'));

            console.debug($chalk.black('cmdName:') + ' ' + $chalk.gray(this.cmd));
            console.debug($chalk.black('cmdArgs:') + ' ' + $chalk.gray($json.stringify(this.args, { pretty: true })));
            console.debug($chalk.black('---'));
        }
    }

    /**
     * Runs CMD.
     */
    public async run(): Promise<void> {
        await this.maybeInstallPackageDependencies();
        const cmdConfigData = await this.structuredCMDConfigData();

        for (const cmdData of cmdConfigData.cmds) {
            if ($is.function(cmdData.cmd)) {
                // Propagates env vars in given CMD.
                await this.propagateCMD(cmdData.env); // @review Forget env vars after each CMD is run?

                if (this.allArgs.madrunDebug) {
                    console.debug($chalk.black('rawEnv:') + ' ' + $chalk.gray($json.stringify(cmdData.env, { pretty: true })));
                    console.debug($chalk.black('rawOpts:') + ' ' + $chalk.gray($json.stringify(cmdData.opts, { pretty: true })));
                    console.debug($chalk.black('rawCMD:') + ' ' + $chalk.gray('[function]')); // Function CMD.
                    console.debug($chalk.black('cmd:') + ' ' + $chalk.gray('[function]')); // Function CMD.
                    console.debug($chalk.black('---'));
                }
                await cmdData.cmd({ cmd: this.cmd, args: this.args, ctx: { ...this.ctx, env: cmdData.env, opts: cmdData.opts } });
            } else {
                // Populates env vars & replacement codes in given CMD.
                const cmd = await this.populateCMD(cmdData.env, cmdData.cmd);

                if (this.allArgs.madrunDebug) {
                    console.debug($chalk.black('rawEnv:') + ' ' + $chalk.gray($json.stringify(cmdData.env, { pretty: true })));
                    console.debug($chalk.black('rawOpts:') + ' ' + $chalk.gray($json.stringify(cmdData.opts, { pretty: true })));
                    console.debug($chalk.black('rawCMD:') + ' ' + $chalk.gray(cmdData.cmd)); // String CMD.
                    console.debug($chalk.black('cmd:') + ' ' + $chalk.gray(cmd));
                    console.debug($chalk.black('---'));
                }
                await $cmd.exec(cmd, { cwd: this.cwd, ...cmdData.opts });
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
            console.debug($chalk.black('Auto-installing NPM package dependencies.'));
            console.debug($chalk.black('---'));
        }
        await $cmd.spawn('npm', canInstallClean ? ['ci'] : ['install'], { cwd: this.cwd });
    }

    /**
     * Gets configuration.
     *
     * @returns Configuration, else `undefined` for events w/o a listener.
     */
    protected async config(): Promise<Config | undefined> {
        let config = undefined; // Initialize.

        if ('default' === this.configFile) {
            config = (await import('../../../default.js')).default as Config;
            //
        } else if (this.configFile.endsWith('.json')) {
            config = (await import(this.configFile, { assert: { type: 'json' } })) as Config;
            //
        } else if (this.configFile) {
            config = ((await import(this.configFile)) as { default: unknown }).default as Config;
        }
        if (undefined === config && this.cmd.startsWith('on::')) {
            return undefined; // Event w/o a listener.
            //
        } else if (undefined === config /* Cannot be null otherwise. */) {
            throw new Error('`' + path.basename(this.configFile) + '` config failure.');
        }
        if (!$is.plainObject(config) && !$is.function(config)) {
            throw new Error('`' + path.basename(this.configFile) + '` config failure.');
        }
        return config;
    }

    /**
     * Gets config function.
     *
     * @returns Config function; else `undefined` for events w/o a listener.
     */
    protected async configFn(): Promise<ConfigFn | ConfigFnSync | undefined> {
        let config = await this.config();

        if (undefined === config && this.cmd.startsWith('on::')) {
            return undefined; // Event w/o a listener.
        }
        if (undefined === config /* Cannot be undefined otherwise. */) {
            throw new Error('`' + path.basename(this.configFile) + '` config failure.');
        }
        if ($is.plainObject(config)) {
            const configObj = config; // Object pointer.
            config = async (): Promise<ConfigFnRtns> => configObj;
        }
        if (undefined === config && this.cmd.startsWith('on::')) {
            return undefined; // Event w/o a listener.
            //
        } else if (undefined === config /* Cannot be undefined otherwise. */) {
            throw new Error('`' + path.basename(this.configFile) + '` config failure.');
        }
        if (!$is.function(config)) {
            throw new Error('`' + path.basename(this.configFile) + '` config failure.');
        }
        return config; // As function.
    }

    /**
     * Gets CMD config for current `cmdName`.
     *
     * @returns CMD config; else `undefined` for events w/o a listener.
     */
    protected async cmdConfig(): Promise<CMDConfig | undefined> {
        const configFn = await this.configFn();

        if (undefined === configFn && this.cmd.startsWith('on::')) {
            return undefined; // Event w/o a listener.
            //
        } else if (undefined === configFn /* Cannot be undefined otherwise. */) {
            throw new Error('`' + path.basename(this.configFile) + '` config failure.');
        }
        const cmdConfigs = await configFn({ cmd: this.cmd, args: this.args, ctx: this.ctx });
        const cmdConfig = cmdConfigs[this.cmd] || undefined; // By CMD name.

        if (undefined === cmdConfig && this.cmd.startsWith('on::')) {
            return undefined; // Event w/o a listener.
            //
        } else if (undefined === cmdConfig /* Cannot be undefined otherwise. */) {
            throw new Error('`' + this.cmd + '` command is unavailable.');
        }
        return cmdConfig;
    }

    /**
     * Gets CMD config function for current `cmdName`.
     *
     * @returns CMD config function; else `undefined` for events w/o a listener.
     */
    protected async cmdConfigFn(): Promise<CMDConfigFn | CMDConfigFnSync | undefined> {
        let cmdConfig = await this.cmdConfig();

        if (undefined === cmdConfig && this.cmd.startsWith('on::')) {
            return undefined; // Event w/o a listener.
            //
        } else if (undefined === cmdConfig /* Cannot be undefined otherwise. */) {
            throw new Error('`' + this.cmd + '` command is unavailable.');
        }
        if ($is.string(cmdConfig)) {
            const cmdConfigStr = cmdConfig; // String pointer.
            cmdConfig = async (): Promise<CMDConfigFnRtns> => cmdConfigStr;
            //
        } else if ($is.array(cmdConfig)) {
            const cmdConfigArr = cmdConfig; // Array pointer.
            cmdConfig = async (): Promise<CMDConfigFnRtns> => cmdConfigArr;
            //
        } else if ($is.plainObject(cmdConfig)) {
            const cmdConfigObj = cmdConfig; // Object pointer.
            cmdConfig = async (): Promise<CMDConfigFnRtns> => cmdConfigObj;
        }
        if (undefined === cmdConfig && this.cmd.startsWith('on::')) {
            return undefined; // Event w/o a listener.
            //
        } else if (undefined === cmdConfig /* Cannot be undefined otherwise. */) {
            throw new Error('`' + this.cmd + '` command is unavailable.');
        }
        if (!$is.function(cmdConfig)) {
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

        if (undefined === cmdConfigFn && this.cmd.startsWith('on::')) {
            return { env: {}, opts: {}, cmds: [] }; // Event w/o a listener.
            //
        } else if (undefined === cmdConfigFn /* Cannot be undefined otherwise. */) {
            throw new Error('`' + this.cmd + '` command is unavailable.');
        }
        let cmdConfigData = await cmdConfigFn({ cmd: this.cmd, args: this.args, ctx: this.ctx });

        cmdConfigData = $is.string(cmdConfigData) ? { cmds: '' === cmdConfigData ? [] : [cmdConfigData] } : cmdConfigData;
        cmdConfigData = $is.array(cmdConfigData) ? { cmds: cmdConfigData } : cmdConfigData;
        cmdConfigData = $is.function(cmdConfigData) ? { cmds: [cmdConfigData] } : cmdConfigData;

        if (!$is.plainObject(cmdConfigData)) {
            throw new Error('`' + this.cmd + '` command config has an invalid data type.');
        }
        cmdConfigData = $obj.assign({ env: {}, opts: {}, cmds: [] }, cmdConfigData) as unknown as CMDConfigObject;
        (cmdConfigData.env = cmdConfigData.env || {}), (cmdConfigData.opts = cmdConfigData.opts || {});

        cmdConfigData.cmds = $is.string(cmdConfigData.cmds) ? ('' === cmdConfigData.cmds ? [] : [cmdConfigData.cmds]) : cmdConfigData.cmds;
        cmdConfigData.cmds = $is.function(cmdConfigData.cmds) ? [cmdConfigData.cmds] : cmdConfigData.cmds;
        cmdConfigData.cmds = $is.plainObject(cmdConfigData.cmds) ? [cmdConfigData.cmds] : cmdConfigData.cmds;

        if (!$is.plainObject(cmdConfigData.env)) {
            throw new Error('`' + this.cmd + '` command config contains invalid data for derived `env` property.');
        }
        if (!$is.plainObject(cmdConfigData.opts)) {
            throw new Error('`' + this.cmd + '` command config contains invalid data for derived `opts` property.');
        }
        if (!$is.array(cmdConfigData.cmds) || !cmdConfigData.cmds.length) {
            throw new Error('`' + this.cmd + '` command config contains invalid data for derived `cmds` property.');
        }
        for (let i = 0; i < cmdConfigData.cmds.length; i++) {
            let cmdData = cmdConfigData.cmds[i];

            cmdData = $is.string(cmdData) ? { cmd: cmdData } : cmdData;
            cmdData = $is.array(cmdData) // This allows a CMD to be given as a `string[]` that we’ll quote automatically.
                ? // Passing a `string[]` is only possible when `cmd` or `cmds` are explicitly given by a CMD object config.
                  // If you pass a `string[]` elsewhere, it will instead be interpreted as a list of CMDs and not CMD parts (see above).
                  {
                      cmd: cmdData
                          .map(String)
                          .map((cmdPart) =>
                              // We must not quote standalone replacement code parts here. That will happen later in {@see populateCMDReplacementCodes()}.
                              // Therefore, config files must be very careful about using replacement codes whenever an array of `string[]` CMD parts
                              // is to be quoted. Replacement codes must exist as standalone parts in the array or they’ll be quoted twice and crash.
                              this.allCMDArgPartsValuesStartToEndRepeatingRegExp.test(cmdPart) || //
                              this.anyCMDArgPartsStartToEndRepeatingRegExp.test(cmdPart) ||
                              this.anyCMDArgValuesStartToEndRepeatingRegExp.test(cmdPart)
                                  ? cmdPart // Defer quoting in this case.
                                  : $cmd.quote(cmdPart),
                          )
                          .join(' '),
                  }
                : cmdData;
            cmdData = $is.function(cmdData) ? { cmd: cmdData } : cmdData;

            if (!$is.plainObject(cmdData)) {
                throw new Error('`' + this.cmd + '` command config contains a CMD with an invalid data type.');
            }
            cmdData = $obj.assign({ env: { ...cmdConfigData.env }, opts: { ...cmdConfigData.opts }, cmd: '' }, cmdData) as unknown as CMDSingleConfigObject;
            (cmdData.env = cmdData.env || {}), (cmdData.opts = cmdData.opts || {});

            if (!$is.plainObject(cmdData.env)) {
                throw new Error('`' + this.cmd + '` command config contains a CMD with invalid data for its derived `env` property.');
            }
            if (!$is.plainObject(cmdData.opts)) {
                throw new Error('`' + this.cmd + '` command config contains a CMD with invalid data for its derived `opts` property.');
            }
            if (!cmdData.cmd || (!$is.string(cmdData.cmd) && !$is.function(cmdData.cmd))) {
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
            return $cmd.quote(v);
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
        (this.args._ as (string | number)[]).forEach((v, i) => {
            const position = String(i + 1);
            const escRegExpPosition = $str.escRegExp(position);
            const quotedArgValue = $cmd.quote(String(v));

            const regExpArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escRegExpPosition + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
            const regExpArgValue = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escRegExpPosition + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu');

            cmd = cmd.replace(regExpArgParts, quotedArgValue);
            cmd = cmd.replace(regExpArgValue, quotedArgValue);
        });
        for (const [n, v] of Object.entries($obj.omit(this.args, u.omitFromNamedArgs))) {
            if ($is.boolean(v) && false === v) {
                continue; // Not applicable.
            }
            const argPrefixedName = '-'.repeat(1 === n.length ? 1 : 2) + n;
            const escRegExpArgPrefixedName = $str.escRegExp(argPrefixedName);

            const quotedArgValues = $is.boolean(v) ? ''
                    : $is.array(v) && n.endsWith('[') ? $cmd.quoteAll(v.concat(']').map(String)).join(' ')
                    : $is.array(v) ? $cmd.quoteAll(v.map(String)).join(' ')
                    : $cmd.quote(String(v)); // prettier-ignore

            const quotedArgParts = $cmd.quote(argPrefixedName) //
                + ($is.boolean(v) ? '' : ' ' + quotedArgValues); // prettier-ignore

            const regExpArgParts = new RegExp('\\{{2}\\s*(?:|[^}]+\\|)' + escRegExpArgPrefixedName + '(?:|\\|[^}]+)\\s*\\}{2}', 'gu');
            const regExpArgValues = new RegExp('\\$\\{{1}\\s*(?:|[^}]+\\|)' + escRegExpArgPrefixedName + '(?:|\\|[^}]+)\\s*\\}{1}', 'gu');

            cmd = cmd.replace(regExpArgParts, quotedArgParts);
            cmd = cmd.replace(regExpArgValues, quotedArgValues);
        }
        cmd = cmd.replace(this.allCMDArgPartsValuesGFlagRegExp, () => {
            let args = []; // Initialize list of arguments.

            for (const v of this.args._ as Array<string | number>) {
                args.push(String(v)); // Positional argument.
            }
            for (const [n, v] of Object.entries($obj.omit(this.args, u.omitFromNamedArgs))) {
                if ($is.boolean(v) && false === v) {
                    continue; // Not applicable.
                }
                const argPrefixedName = '-'.repeat(1 === n.length ? 1 : 2) + n;

                const argValues = $is.boolean(v) ? []
                    : $is.array(v) && n.endsWith('[') ? v.concat(']').map(String)
                    : $is.array(v) ? v.map(String)
                    : [String(v)]; // prettier-ignore

                args.push(argPrefixedName);
                args = args.concat(argValues);
            }
            return $cmd.quoteAll(args).join(' ');
        });
        // Empty any others remaining; i.e., that were not already filled above.
        cmd = cmd.replace(this.anyCMDArgPartsGFlagRegExp, '').replace(this.anyCMDArgValuesGFlagRegExp, '');

        // Finally, compress any superfluous whitespace left behind by replacements.
        return cmd.replace(/[\t ]+/gu, ' ').trim();
    }

    /**
     * Caches frequently used regular expressions.
     *
     * @note The `|` pipe can be used to delimit positional or named arg aliases.
     * @note The global `g` flag is stateful, so we create separate RegExps for those.
     */
    protected allCMDArgPartsValuesRegExpStr = '\\$\\{{1}@\\}{1}|\\{{2}@\\}{2}'; // ← Both formats.
    protected anyCMDArgPartsRegExpStr = '\\{{2}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{2}';
    protected anyCMDArgValuesRegExpStr = '\\$\\{{1}\\s*(?:|[^}]+\\|)(?:[0-9]+|-{1,2}[^|}]+)(?:|\\|[^}]+)\\s*\\}{1}';

    protected allCMDArgPartsValuesRegExp = new RegExp(this.allCMDArgPartsValuesRegExpStr, 'u');
    protected anyCMDArgPartsRegExp = new RegExp(this.anyCMDArgPartsRegExpStr, 'u');
    protected anyCMDArgValuesRegExp = new RegExp(this.anyCMDArgValuesRegExpStr, 'u');

    protected allCMDArgPartsValuesStartToEndRegExp = new RegExp('^' + this.allCMDArgPartsValuesRegExpStr + '$', 'u');
    protected anyCMDArgPartsStartToEndRegExp = new RegExp('^' + this.anyCMDArgPartsRegExpStr + '$', 'u');
    protected anyCMDArgValuesStartToEndRegExp = new RegExp('^' + this.anyCMDArgValuesRegExpStr + '$', 'u');

    protected allCMDArgPartsValuesStartToEndRepeatingRegExp = new RegExp('^(?:' + this.allCMDArgPartsValuesRegExpStr + '\\s*)+$', 'u');
    protected anyCMDArgPartsStartToEndRepeatingRegExp = new RegExp('^(?:' + this.anyCMDArgPartsRegExpStr + '\\s*)+$', 'u');
    protected anyCMDArgValuesStartToEndRepeatingRegExp = new RegExp('^(?:' + this.anyCMDArgValuesRegExpStr + '\\s*)+$', 'u');

    protected allCMDArgPartsValuesGFlagRegExp = new RegExp(this.allCMDArgPartsValuesRegExpStr, 'gu');
    protected anyCMDArgPartsGFlagRegExp = new RegExp(this.anyCMDArgPartsRegExpStr, 'gu');
    protected anyCMDArgValuesGFlagRegExp = new RegExp(this.anyCMDArgValuesRegExpStr, 'gu');
}
