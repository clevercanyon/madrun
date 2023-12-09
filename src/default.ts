/**
 * Default config file.
 */

import '#@init.ts';

import type { Props } from '#@cli/cmds/run.ts';
import * as u from '#@cli/utilities.ts';
import { $brand, $fn, $is, $url } from '@clevercanyon/utilities';
import { $cmd, $fs, $yargs } from '@clevercanyon/utilities.node';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';

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
                await $yargs.cli({
                    strict: false,
                    scriptName: 'madrun',
                    errorBoxName: 'madrun',
                    version: u.appPkgVersion,
                })
            )
                .command({
                    command: ['new <projDir> [template]'],
                    describe: 'Starts a new project using an existing GitHub repo as a template.',
                    builder: (yargs) => {
                        return yargs
                            .positional('projDir', {
                                type: 'string',
                                demandOption: true,
                                default: '',
                                describe: 'New project directory basename, subpath, or absolute path.',
                            })
                            .positional('template', {
                                type: 'string',
                                demandOption: false,
                                default: '{{parentDirBasename}}/skeleton',
                                description: // prettier-ignore
									'Git repository to clone and use as a template.' +
									' Can be a full URL, or just `owner/repo` will suffice when cloning a GitHub repository.' +
									' If there is no `/` in the value given, it’s auto-prefixed with `{{parentDirBasename}}/`.',
                            })
                            .options({
                                from: {
                                    type: 'string',
                                    requiresArg: true,
                                    demandOption: false,
                                    default: '',
                                    alias: ['clone', 'skeleton'],
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
										' The repository you’re cloning must support this option in it’s madrun config file.',
                                },
                                pkgName: {
                                    type: 'string',
                                    requiresArg: true,
                                    demandOption: false,
                                    default: '',
                                    description: // prettier-ignore
										'Indicates intent to use a specific package name.' +
										' This option is simply passed to an `on::madrun:default:new` event handler.' +
										' The repository you’re cloning must support this option in it’s madrun config file.',
                                },
                                public: {
                                    type: 'boolean',
                                    requiresArg: false,
                                    demandOption: false,
                                    default: false,
                                    description: // prettier-ignore
										'Indicates intent to create a public project.' +
										' This option is simply passed to an `on::madrun:default:new` event handler.' +
										' The repository you’re cloning must support this option in it’s madrun config file.',
                                },
                            })
                            .check(async (/* args */) => {
                                return true;
                            });
                    },
                    handler: async (args) => {
                        /**
                         * Validates `projDir`.
                         */
                        if (!args.projDir) {
                            throw new Error('Missing new directory location.');
                        }

                        /**
                         * Initializes a few variables.
                         */
                        const projDir = path.resolve(ctx.cwd, args.projDir);

                        const _parentDirBasename = path.basename(path.dirname(projDir));
                        const _dirBasename = path.basename(projDir);

                        const _maybeParentDirBrand = $fn.try(() => $brand.get('@' + _parentDirBasename + '/' + _dirBasename))();
                        const _parentDirOwner = $is.brand(_maybeParentDirBrand) ? _maybeParentDirBrand.org.slug : _parentDirBasename;

                        let fromRepo = args.from || args.template || '{{parentDirBasename}}/skeleton';
                        fromRepo = fromRepo.replace(/\{{2}\s*parentDirBasename\s*\}{2}/giu, $url.encode(_parentDirOwner));

                        if (fromRepo.includes('@')) fromRepo = fromRepo.replace(/^@/u, '');
                        if (!fromRepo.includes('/')) fromRepo = $url.encode(_parentDirOwner) + '/' + fromRepo;
                        if (!fromRepo.includes('//')) fromRepo = 'https://github.com/' + fromRepo;
                        if (!fromRepo.endsWith('.git')) fromRepo += '.git';

                        const fromBranch = args.branch || 'main';

                        /**
                         * Further validates `projDir` argument.
                         */
                        if (fs.existsSync(projDir)) {
                            throw new Error('Directory already exists: `' + projDir + '`.');
                        }
                        if (!fs.existsSync(path.dirname(projDir))) {
                            throw new Error('Nonexistent parent directory: `' + path.dirname(projDir) + '`.');
                        }

                        /**
                         * Clones remote git repo and then deletes hidden `.git` directory.
                         */
                        await $cmd.spawn('git', ['clone', fromRepo, projDir, '--branch', fromBranch, '--depth=1'], { cwd: ctx.cwd });
                        await fsp.rm(path.resolve(projDir, './.git'), { recursive: true, force: true });

                        /**
                         * Fires an event if new directory contains a madrun config file.
                         */
                        if (await $fs.findUp(u.configFiles, { cwd: projDir, stopAt: projDir })) {
                            const argsToEventHandler = [...(args.pkg ? ['--pkg'] : []), ...(args.pkgName ? ['--pkgName', args.pkgName] : []), ...(args.public ? ['--public'] : [])];
                            await $cmd.spawn('npx', ['@clevercanyon/madrun', 'on::madrun:default:new', ...argsToEventHandler], { cwd: projDir });
                        }
                    },
                })
                .parse();
        },
    ],
};
