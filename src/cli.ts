/**
 * CLI handler.
 */

import '#@initialize.ts';

import Run from '#@cli/cmds/run.ts';
import * as u from '#@cli/utilities.ts';
import { $yargs } from '@clevercanyon/utilities.node';

/**
 * Yargs ⛵🏴‍☠.
 */
void (async () => {
    await (
        await $yargs.cli({
            strict: false,
            scriptName: 'madrun',
            errorBoxName: 'madrun',
            helpOption: 'madrunHelp',
            versionOption: 'madrunVersion',
            version: u.appPkgVersion,
        })
    )
        .command({
            command: ['$0'], // Default and only well-defined CMD here.
            describe: 'Runs commands, shell scripts, or JS functions configured by a `' + u.configFilesGlob + '` file.',
            builder: (yargs) => {
                return yargs
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
                await u.propagateUserEnvVars();
                await new Run(args as u.AllArgs).run();
            },
        })
        .parse();
})();
