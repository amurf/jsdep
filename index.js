var RegistryClient = require('bower-registry-client');
var registry       = new RegistryClient();
var cp             = require('child_process');
var shell          = require('shelljs');
var semver         = require('semver');

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
        run_cmd('git', ['ls-remote', '--tags', '--heads', json.url], extract_tags).then(function(version) {
            console.log(`* Installing ${lib_name} ${version}`);
            git_clone(json.url, filetype, lib_name, version);
        });
    }
}

function git_clone(url, filetype, lib_name, version) {
    var tmpdir = shell.tempdir() + lib_name;
    var args = ['clone',  url, '--depth', 1, '-b', version, '--progress', tmpdir];

    run_cmd('git', args).then(function(out, err) {
        copy_files(tmpdir, filetype, lib_name, version);
    });
}

function copy_files(tmpdir, filetype, lib_name, version) {
    function from_dir(path) {
        return `${tmpdir}/${path}`;
    }

    var file_match = `*.min.${filetype}`;

    // If not using flat bower file structure, find in dist folder
    if (dir_exists(from_dir('dist'))) {
        copy_to_dir(from_dir(`dist/${filetype}/${file_match}`), to_dir(filetype));
    } else {
        copy_to_dir(from_dir(file_match), to_dir(filetype));
    }

    console.log(`* Installed ${lib_name} version ${version}`);
    shell.rm('-rf', tmpdir);
}


function run_cmd(cmd, args, func) {
    var result  = Q.defer();
    var process = cp.spawn(cmd, args);
    var stdout, stderr;

    process.stdout.on('data', function(data) {
        stdout += data;
    });

    process.stderr.on('data', function(data) {
        stderr += data;
    });


    process.on('close', function(error_code) {
        if (func) {
            result.resolve(func(stdout, stderr));
        } else {
            result.resolve([stdout, stderr]);
        }
    });

    return result.promise;
}

function dir_exists(dir) {
    return shell.test('-d', dir);
}

function to_dir(path) {
    return `${cfg.install_dir}/${path}/`;
}

function copy_to_dir(files, dir) {
    if (!dir_exists(dir)) {
        shell.mkdir('-p', dir);
    }
    shell.cp('-f', files, dir);
}

function max_satisfying(versions) {
    versions = versions.filter((version) => { return semver.valid(version) });
    // Always look for latest version '*' 
    return semver.maxSatisfying(versions, '*');
}

function extract_tags(out, err) {
    var tags = [];
    var refs = out.toString()
                  .trim()
                  .replace(/[\t ]+/g, ' ')
                  .split(/[\r\n]+/);

    refs.forEach(function(ref) {
        var match = ref.match(/^[a-f0-9]{40}\s+refs\/tags\/(\S+)/);
        if (match) {
            tags.push(match[1]);
        }
    });

    return max_satisfying(tags);
}

