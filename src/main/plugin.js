/* global require, process, Buffer */
'use strict';

var map = require('vinyl-map2');
var gutil = require('gulp-util');
var readline = require('readline');
var files = require('fs');
var paths = require('path');
var StringBuilder = require('stringbuilder');
var Promise = require('promise');

/**
 *
 * @param {File} filepath The path to the file being scanned.
 * @param {Promise<Buffer>} promise A promise resolving to the buffer output.
 * @param {Object} context
 * @param {Boolean} debug Whether to display debug messages during work.
 * @returns {Promise<Buffer>}
 */
function scanFile(filepath, promise, context, debug) {
	return new Promise(function(resolve, reject) {

		// Make sure the file hasn't already been processed
		if (context[filepath]) {
			gutil.log('===> ' + filepath + ' already processed.');
			return promise.then(resolve, reject);
		}

		gutil.log('===> Processing ' + filepath);

		// Add target file to the context to avoid repeats.
		context[filepath] = true;

		// Start the promise chain.
		var lastPromise = promise;

		var lineStream = readline.createInterface({
			input: files.createReadStream(filepath),
			terminal: false
		});

		lineStream.on('line', function(line) {
			lastPromise = lastPromise.then(function(builder) {

				var matches = /^@import (?:\(inline\) )?[\'"](.+?)[\'"];/.exec(line);
				if (!matches) {

					if (debug) {
						gutil.log('=> ' + line);
					}

					return builder.appendLine(line);

				}

				var importpath = matches[1];
				if (!paths.extname(importpath)) {
					importpath += '.less';
				}

				var fileDir = /^[\/\\]/.test(importpath)
						? process.cwd()
						: paths.dirname(filepath);

				var targetPath = paths.resolve(fileDir, './' + importpath);
				return scanFile(targetPath, promise, context, debug);

			});
		});

		lineStream.on('error', function(error) {
			gutil.log('Stream error');
			reject(error);
		});

		lineStream.on('close', function() {
			lastPromise.then(resolve).catch(reject);
		});

	});
}

/**
 * @param {File} filepath The path to the file being scanned.
 * @param {Boolean} debug Whether to display debug messages during work.
 * @returns {Promise<Buffer>}
 **/
function startScan(filepath, debug) {
	gutil.log('Starting style precompilation with ' + filepath);
	return scanFile(filepath, Promise.resolve(new StringBuilder()), {}, debug);
}

/**
 * Creates a new precompiler for use in a gulp workflow.
 * @param {Object} [options] The plugin options.
 * @param {Boolean} [options.debug] Whether to log debug messages.
 */
module.exports = function lessPrecompiler(options) {

	var config = {

		debug: options
			&& options.debug

	};

	return map(function (content, filepath, done) {

		if (!content || !filepath || !filepath.match(/\.(?:le|c)ss$/)) {
			done(null, content);
		}

		startScan(filepath, config.debug).then(function(builder) {
			return builder.build(function(error, result) {

				if (error) {
					return done(error);
				}

				done(null, result.toString());

			});
		}).catch(function(error) {
			gutil.log('Scan failed: ' + error.stack);
			done(error);
		});

	});

};
