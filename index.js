var RegistryClient = require('bower-registry-client');
var registry       = new RegistryClient();
var cp             = require('child_process');
var shell          = require('shelljs');

var Q                 = require('Q');
var bower_lookup      = Q.denodeify(registry.lookup);
var bower_read_config = Q.denodeify(require('bower-json').read);

var cfg        = require('./jsdep.js');
var javascript = cfg.js;
var css        = cfg.css;

javascript.forEach(function(lib_name) {
    registry.lookup(lib_name, fetch_func(lib_name, 'js'))
});

css.forEach(function(lib_name) {
    registry.lookup(lib_name, fetch_func(lib_name, 'css'))
});

function fetch_func(lib_name, filetype) {
    return function(err, json) {
        if (!json) {
            console.error(`* Error during lookup: ${lib_name} not found`);
            return;
        }

        console.log(`* Installing ${lib_name}`);
        git_clone(json.url, filetype, lib_name);
    }
}

function git_clone(url, filetype, lib_name) {
    var tmpdir = shell.tempdir() + `/${lib_name}`;
    var args = ['clone',  url, '--depth', 1, '-b', 'master', '--progress', tmpdir];
    var clone = cp.spawn('git', args);
    clone.on('close', function(error_code) {
        if (error_code == '0') {
            copy_files(tmpdir, filetype);
        } else {
            console.log(`! Error (${error_code}) installing ${lib_name}: couldn't clone package`);
            shell.rm('-rf', tmpdir);
        }
    });
}

function copy_files(tmpdir, filetype) {
    function from_dir(path) {
        return `${tmpdir}/${path}/`;
    }

    var file_match = `*.min.${filetype}`;
    // If not using flat bower file structure, find in dist folder
    if (shell.test('-d', from_dir('dist'))) {
        copy_to_dir(from_dir(`dist/${filetype}/${file_match}`), to_dir(filetype));
    } else {
        copy_to_dir(from_dir(file_match), to_dir(filetype));
    }

    bower_read_config(`${tmpdir}/bower.json`).then(function(json) {
        // bower config is an array..?
        var config  = json.shift();
        var version = config.version || 'latest';
        console.log(`* Installed ${config.name} version ${version}`);

        shell.rm('-rf', tmpdir);
    });
}

function to_dir(path) {
    return `${cfg.install_dir}/${path}/`;
}

function copy_to_dir(files, dir) {
    if (!shell.test('-d', dir)) {
        shell.mkdir('-p', dir);
    }
    shell.cp(files, dir);
}
