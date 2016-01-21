/* global require, process, Buffer */
'use strict';

var map = require('vinyl-map2');
var gutil = require('gulp-util');
var Promise = require('promise');

var scanner = require('./scanner');

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

		scanner(filepath, config.debug).then(function(builder) {
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
