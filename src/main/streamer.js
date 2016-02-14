/* global require, process, Buffer */
'use strict';

var gutil = require('gulp-util');
var files = require('fs');
var readline = require('readline');
var paths = require('path');
var Promise = require('promise');

/**
 *
 * @param {File} filepath The path to the file being scanned.
 * @param {Promise<Buffer>} promise A promise resolving to the buffer output.
 * @param {Object} context
 * @param {Boolean} debug Whether to display debug messages during work.
 * @param {Array} [counter] Contains the current path counter.
 * @returns {Promise<Buffer>}
 */
function scanFile(filepath, promise, context, debug, counter) {
	return new Promise(function(resolve, reject) {

		counter && counter.push(0);

		// Make sure the file hasn't already been processed
		if (context[filepath]) {
			gutil.log('===> ' + filepath + ' already processed.');
			counter && counter.pop();
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
				counter && counter[counter.length - 1]++;

				var matches = /^@import [\'"](.+?)[\'"];/.exec(line);
				if (!matches) {

					if (debug) {
						gutil.log('=> ' + line);
					}

					return builder.appendLine(line + ( counter
									? " // " + counter.join(" / ")
									: "" ));

				}

				var importpath = matches[1];
				if (!paths.extname(importpath)) {
					importpath += '.less';
				}

				var fileDir = /^[\/\\]/.test(importpath)
						? process.cwd()
						: paths.dirname(filepath);

				var targetPath = paths.resolve(fileDir, './' + importpath);
				return scanFile(targetPath, promise, context, debug, counter);

			});
		});

		lineStream.on('error', function(error) {
			gutil.log('Stream error');
			reject(error);
		});

		lineStream.on('close', function() {
			lastPromise.then(function(builder) {
				counter && counter.pop();
				resolve(builder);

			}).catch(reject);
		});

	});
}

/**
 *
 * @param {String} filepath
 * @param {Object} options
 * @param {Function} options.line
 * @param {Function} options.error
 * @param {Function} options.close
 */
module.exports = function streamFile(filepath, options) {

	var lineStream = readline.createInterface({
		input: files.createReadStream(filepath),
		terminal: false
	});

	lineStream.on('line', options.line);

	lineStream.on('error', options.error);

	lineStream.on('close', options.close);

};
