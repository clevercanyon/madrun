/**
 * Terser configuration.
 *
 * Vite is not aware of this config file's location.
 *
 * @note PLEASE DO NOT EDIT THIS FILE!
 * @note This entire file will be updated automatically.
 * @note Instead of editing here, please review <https://github.com/clevercanyon/skeleton>.
 *
 * @see https://vite.dev/config/build-options.html#build-terseroptions
 */

import u from '../../../../../resources/utilities.mjs';

/**
 * Configures terser.
 *
 * @param   props Props from vite config file driver.
 *
 * @returns       Terser configuration.
 */
export default async (/* {} */) => {
    return {
        terserConfig: {
            module: true,
            toplevel: true,
            ecma: u.es.version.year,
            compress: { passes: 1 },
            format: { comments: false },
        },
    };
};
