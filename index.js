/* global require */
'use strict';

var through2 = require('through2');
var gutil = require('gulp-util');
var readline = require('readline');
var files = require('fs');
var paths = require('path');
var StringBuilder = require('stringbuilder');
var File = require('vinyl');

var REGEX_IMPORT = new RegExp('@import [\'"](.+?)[\'"];');

/**
 *
 * @param {File} file
 * @param {Promise<Buffer>} promise
 * @param {Object} context
 * @returns {Promise<Buffer>}
 */
function scanFile(file, promise, context) {
	return new Promise(function(resolve, reject) {

		var target = file.path;

		// Make sure the file hasn't already been processed
		if (context[target]) {
			promise.then(resolve, reject);
		}

		// Add target file to the context to avoid repeats.
		context[target] = file;

		// Start the promise chain.
		var lastPromise = promise;

		var lineStream = readline.createInterface({
			input: files.createReadStream(target)
		});

		lineStream.on('line', function(line) {
			lastPromise = lastPromise.then(function(builder) {

				var matches = REGEX_IMPORT.exec(line);
				if (!matches) {
					gutil.log('=> ' + line);
					return builder.appendLine(line);
				}

				var fileDir = paths.dirname(file.path);
				var targetPath = paths.resolve(fileDir, matches[1]);
				var targetFile = new File({
					path: targetPath,
					history: [ targetPath ],
					cwd: file.cwd,
					base: file.base
				});

				return scanFile(targetFile, promise, context);

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
 * @param {File} file
 * @returns {Promise<Buffer>}
 **/
function startScan(file) {
	gutil.log('Starting style precompilation with ' + file.path);
	return scanFile(file, Promise.resolve(new StringBuilder()), []);
}

module.exports = function lessPrecompiler(options) {


	return through2.obj(function(file, encoding, done) {

		if (file.isNull()) {
			done(null, file);
		}

		startScan(file).then(function(builder) {

			if (file.isBuffer()) {
				return builder.build(function(error, result) {

					if (error) {
						return done(error);
					}

					file.contents = new Buffer(result);
					done(null, file);

				});

			}

			if (file.isStream()) {
				file.contents = new Stream();
				return builder.writeStream(file.contents, done);

			}

			return null;

		}).catch(function(error) {
			gutil.log('Scan failed: ' + error.stack);
			done(error);
		});

	})
}

