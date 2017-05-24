const Cache = require('file-system-cache').default;
const urlParser = require('url');
const cache = Cache({
	basePath: __dirname + '/cache'
});

class Tfs {
	constructor(request, endpoints, credentials) {
		this.request = request;
		this.endpoints = endpoints;
		this.credentials = credentials;
		this.queue = [];
	}

	get(endpoint, url) {
		return new Promise((resolve, reject) => {
			this.queue.push({
				resolve: resolve,
				reject: reject,
				cache: false,
				url: urlParser.resolve(endpoint + '/', url)
			});

			this.processQueue();
		});		
	}

	getCached(endpoint, url) {
		return new Promise((resolve, reject) => {
			this.queue.push({
				resolve: resolve,
				reject: reject,
				cache: true,
				url: urlParser.resolve(endpoint + '/', url)
			});

			this.processQueue();
		});
	}

	processQueue() {
		function complete(error, response) {
			if (error) {
				console.log('[' + (new Date()).toString() + ']: Error whilst requesting ' + this.curr.url + ' (' + error.message +')');
				this.curr.reject(error);
			} else {
				try {
					this.curr.resolve(JSON.parse(response.body));
				} catch (e) {
					console.log('[' + (new Date()).toString() + ']: Response for ' + this.curr.url + ' was not valid JSON');
					console.log(response.body);
					this.curr.reject(new Error('Invalid JSON'));
				}
			}

			var shouldCache = this.curr.cache;

			if (shouldCache) {
				cache.set(this.curr.url, response);
			}

			this.curr = undefined;

			if (shouldCache) {
				this.processQueue();
			} else {
				setTimeout(() => {
					this.processQueue();
				}, 100);
			}
		}

		if (!this.curr && this.queue.length) {
			this.curr = this.queue.pop();

			if (this.curr.cache) {
				var cached = cache.getSync(this.curr.url);

				if (cached !== undefined) {
					console.log('[' + (new Date()).toString() + ']: ' + this.curr.url + ' has been served from the cache');
					return complete.call(this, null, cached);
				}
			}

			var opts = {
				url: this.curr.url,
				strictSSL: false
			};

			if (typeof this.credentials === 'string') {
				opts.headers = {
					Authorization: 'Basic ' + new Buffer(':' + this.credentials).toString('base64')
				};
			} else {
				Object.assign(opts, this.credentials);
			}

			console.log('[' + (new Date()).toString() + ']: Making request to ' + this.curr.url);

			this.request.get(opts, complete.bind(this));
		}
	}
};

module.exports.create = function(host, collection, credentials) {
	var endpoints = {};
	var request = typeof credentials === 'string' 
		? require('request')
		: require('httpntlm');

	['build', 'test', 'projects'].forEach((endpoint) => endpoints[endpoint] = urlParser.resolve(host + '/', collection));

	if (host.indexOf('.visualstudio.com') === -1) {
		endpoints.release = urlParser.resolve(host + '/', collection);
	} else {
		endpoints.release = urlParser.resolve(host.replace(/\.visualstudio\.com/, '.vsrm.visualstudio.com'), collection);
	}

	return new Tfs(request, endpoints, credentials);
};