/* global require, process, Buffer */
'use strict';

var gutil = require('gulp-util');
var readline = require('readline');
var paths = require('path');
var StringBuilder = require('stringbuilder');
var Promise = require('promise');

var streamer = require('./streamer');

/**
 *
 * @param {String} filePath The path to the file being scanned.
 * @param {Promise<Buffer>} promise A promise resolving to the buffer output.
 * @param {Object} context
 * @param {Boolean} debug Whether to display debug messages during work.
 * @param {Array} [counter] Contains the current path counter.
 * @returns {Promise<Buffer>}
 */
function scanFile(filePath, promise, context, debug, counter) {
	return new Promise(function(resolve, reject) {

		counter && counter.push(0);

		// Make sure the file hasn't already been processed
		if (context[filePath]) {
			gutil.log('===> ' + filePath + ' already processed.');
			counter && counter.pop();
			return promise.then(resolve, reject);
		}

		gutil.log('===> Processing ' + filePath);

		// Add target file to the context to avoid repeats.
		context[filePath] = true;

		// Start the promise chain.
		var lastPromise = promise;

		streamer(filePath, {

			line: function(line) {
				lastPromise = lastPromise.then(function(builder) {
					counter && counter[counter.length - 1]++;

					var matches = /^@import (?:\(inline\) )?[\'"](.+?)[\'"];/.exec(line);
					if (!matches) {

						if (debug) {
							gutil.log('=> ' + line);
						}

						return builder.appendLine(line + ( counter
										? " // " + counter.join(" / ")
										: "" ));

					}

					var importPath = matches[1];
					if (!paths.extname(importPath)) {
						importPath += '.less';
					}

					var fileDir = /^[\/\\]/.test(importPath)
							? process.cwd()
							: paths.dirname(filePath);

					var targetPath = paths.resolve(fileDir, './' + importPath);
					return scanFile(targetPath, promise, context, debug, counter);

				});
			},

			error: function(error) {
				gutil.log('Stream error');
				reject(error);
			},

			close: function() {
				lastPromise.then(function(builder) {
					counter && counter.pop();
					resolve(builder);

				}).catch(reject);
			}

		})

	});
}

/**
 * @param {String} filePath The path to the file being scanned.
 * @param {Boolean} debug Whether to display debug messages during work.
 * @returns {Promise<Buffer>}
 **/
module.exports = function startScan(filePath, debug) {
	gutil.log('Starting style pre-compilation with ' + filePath);
	return scanFile(filePath, Promise.resolve(new StringBuilder()), {}, debug, debug ? [] : undefined);
};
