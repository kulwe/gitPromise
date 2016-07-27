/**
 * Created by kule on 2016/7/20.
 */
var ShellPromiseChain = require('shell-promise-chain');
var _ = require('lodash');
var regLine = /(?:\r\n|\r|\n)/g;
var regCommitEmpty = /nothing to commit, working directory clean/i;

var gitPromise = function (config) {
    var shell = new ShellPromiseChain(config);
    shell.status = function () {
        return shell.exec('git status --porcelain', function (error, resolve, reject, stdout) {
            if (error) {
                return reject(error);
            }
            if (stdout.length < 1) {
                return reject('文件无变化，终止git');
            }
            return resolve(stdout);
        });
    };
    var regCommitOk = function (msg) {
        return new RegExp('\\[\\S+\\s([0-9a-f]{7})\\]\\s' + msg);
    };
    shell.commit = function (msg,canEmpty) {
        return shell.exec('git add .')
            .exec(`git commit -a -m "${msg}"`, function (error, resolve, reject, stdout) {
                if(canEmpty&&regCommitEmpty.test(stdout)){
                    return resolve('');
                }
                if (error) {
                    return reject(error);
                }
                var hash = stdout.match(regCommitOk(msg));
                return resolve(hash ? hash[1] : stdout);
            });
    };
    shell.tag = function (tag, msg, commit, notSyncRemote) {
        if (notSyncRemote) {
            return shell.exec(`git tag -a ${tag} -m "${msg}" ${commit}`);
        }
        return shell.exec(`git tag -a ${tag} -m "${msg}" ${commit}`)
            .exec(`git push origin ${tag}`);
    };
    shell.delTag = function (tag, notSyncRemote) {
        if (notSyncRemote) {
            return shell.exec(`git tag -d ${tag}`);
        }
        return shell.exec(`git tag -d ${tag}`)
            .exec(`git push origin :refs/tags/${tag}`);
    };
    shell.push = function () {
        return shell.exec('git push');
    };
    shell.pull = function () {
        return shell.exec('git pull');
    };
    shell.findCommit = function (pattern) {
        return shell.exec(`git log --grep="${pattern}" --pretty=format:%h`);
    };
    shell.diffTwoCommit = function (commit, lastCommit) {
        return shell.exec(`git diff --name-only ${commit} ${lastCommit} --diff-filter=RAMC`, function (error, resolve, reject, stdout) {
            if (error) {
                return reject(error);
            }
            /*            if (stdout.length < 1) {
             return reject('版本没有差异！');
             }*/
            return resolve(stdout.replace(regLine, ' '));
        });
    };
    shell.findTag = function (pattern) {
        return shell.exec(`git tag -l ${pattern}`, function (error, resolve, reject, stdout) {
            if (error) {
                return reject(error);
            }
            var rst = stdout.replace(regLine, ' ');
            return resolve(_.trim(rst));
        });
    };
    shell.cleanLocalTag = function () {
        return shell.exec('git tag').exec(function (data) {
            var tags = data.result.replace(regLine, ' ');
            return `git tag -d ${tags}`;
        });
    };
    shell.archive = function (commit, files, zipName, prefix) {
        return shell.exec(`git archive ${commit} ${files} -o ${zipName} --prefix=${prefix || ''}`, function (error, resolve, reject, stdout) {
            if (error) {
                return reject(error);
            }
            return resolve(zipName + '创建成功！');
        });
    };
    shell.lastCommit = function () {
        return shell.exec('git log --pretty=format:%h -1');
    };
    shell.sync = function (errTip) {
        return shell.exec('git status --porcelain', function (error, resolve, reject, stdout) {
            if (error) {
                return reject(error);
            }
            if (stdout.length > 0) {
                return reject(errTip || '有未提交代码，请处理后，再同步！');
            }
            return resolve(stdout);
        }).cleanLocalTag().pull().push();
    };
    shell.clone = function (gitUrl, dir) {
        return shell.exec(`git clone ${gitUrl} ${dir}`);
    };
    shell.checkout = function (commit) {
        return shell.exec(`git checkout ${commit}`);
    };
    var regCommitTag = /tag:\s*(.+)/i;
    shell.commitTag = function (commit) {
        return shell.exec(`git show ${commit} --pretty=format:%d --shortstat`, function (error, resolve, reject, stdout) {
            if (error) {
                return reject(error);
            }
            var rst = stdout.match(regCommitTag);
            return resolve(rst && rst[1]);
        })
    };
    return shell;
};

gitPromise.isCommitEmpty = function (error) {
    return regCommitEmpty.test(error);
};
module.exports = gitPromise;