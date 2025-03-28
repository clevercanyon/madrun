/**
 * DTS plugin.
 *
 * Vite is not aware of this config file's location.
 *
 * @note PLEASE DO NOT EDIT THIS FILE!
 * @note This entire file will be updated automatically.
 * @note Instead of editing here, please review <https://github.com/clevercanyon/skeleton>.
 *
 * @see https://www.npmjs.com/package/vite-plugin-dts
 */

import pluginConfig from 'vite-plugin-dts';
import u from '../../../../../resources/utilities.mjs';

/**
 * Configures DTS plugin.
 *
 * @param   props Props from vite config file driver.
 *
 * @returns       DTS plugin.
 */
export default async ({ isSSRBuild }) => {
    if (isSSRBuild) {
        return null; // Not applicable.
    }
    return pluginConfig({
        logLevel: 'error',
        outDir: u.distDir + '/types',
    });
};
