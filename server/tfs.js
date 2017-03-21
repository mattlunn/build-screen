const request = require('httpntlm');
const config = require('./config');
const urlParser = require('url');
var queue = [];
var cache = {};
var curr;

function processQueue() {
	if (!curr && queue.length) {
		curr = queue.pop();

		var url = urlParser.resolve(config.tfsUrl + '/' + config.tfsCollection + '/', curr.url);
		console.log('[' + (new Date()).toString() + ']: Making request to ' + url);

		request.get({
			username: config.ntlmUsername,
			password: config.ntlmPassword,
			domain: config.ntlmDomain,
			workstation: 'My WorkStation',
			url: url
		}, function (error, response) {
			if (error) {
				console.log('[' + (new Date()).toString() + ']: Error whilst requesting ' + url + ' (' + err.message +')');
				curr.reject(error);
			} else {
				try {
					curr.resolve(JSON.parse(response.body));
				} catch (e) {
					console.log('[' + (new Date()).toString() + ']: Response for ' + url + ' was not valid JSON');
					curr.reject(new Error('Invalid JSON'));
				}
			}

			setTimeout(function () {
				curr = undefined;
				processQueue();
			}, config.requestBackoffPeriodMs);
		});
	}
}

module.exports.get = function (url) {
	return new Promise((resolve, reject) => {
		queue.push({
			resolve: resolve,
			reject: reject,
			url: url
		});

		processQueue();
	});
};

module.exports.getCached = function (url) {
	return new Promise((resolve, reject) => {
		if (cache.hasOwnProperty(url)) {
			console.log('[' + (new Date()).toString() + ']: Serving ' + url + ' from the cache...');

			resolve(cache[url]);
		} else {
			queue.push({
				resolve: function (obj) {
					cache[url] = obj;
					resolve(obj);
				},
				reject: reject,
				url: url
			});

			processQueue();
		}
	});
};