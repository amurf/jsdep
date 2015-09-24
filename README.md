# jsdep

Grab latest versions of css/js libraries.

## Config

The config below will install angular into src/vendor/js/ and bootsrap (CSS only, ignoring the JS) into src/vendor/css.

    // jsdep.js
    module.exports = {
        js: [
            "angular"
        ],
        css: [
            "bootstrap"
        ],
        install_dir: 'src/vendor'
    };
    
## Usage

Create a config like above and then just `jsdep` to install/update. Will always override with the latest available version.
