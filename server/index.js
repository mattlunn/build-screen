'use strict';

const config = require('./config');
const fs = require('fs');
const request = require('httpntlm');
const express = require('express');
const tfs = require('./tfs');
const app = express();
const Build = require('../common/domain/Build');
const BuildStep = require('../common/domain/BuildStep');
const BuildStatus = require('../common/domain/BuildStatus');
const buildStatusCache = {};

// What follows is the biggest abuse of JavaScript the world has ever seen. I should be shot. I apologise.
app.get('/data', function (req, res) {
	var projects = (req.query.projects || '').split(/[;,]/g).filter(project => project.length);

	function parseBuildStatus(build) {
		switch (build.status) {
			case 'inProgress':
				return BuildStatus.IN_PROGRESS;
			case 'cancelled':
				return BuildStatus.CANCELLED;
			case 'completed':
			case 'succeeded':
				return parseBuildResult(build.result);
		}
	}

	function parseReleaseStatus(release) {
		switch (release.status) {
			case 'rejected':
				return BuildStatus.RED;
			case 'succeeded':
				return BuildStatus.GREEN;
			case 'inProgress':
				return BuildStatus.IN_PROGRESS;
			default:
				console.log('"' + release.status + '" is not handled as a release status...');
				return BuildStatus.GREEN;
		}
	}

	function parseBuildResult(result) {
		switch (result) {
			case 'succeeded':
				return BuildStatus.GREEN;
			case 'partiallySucceeded':
			case 'succeededWithIssues':
				return BuildStatus.ORANGE;
			case 'failed':
				return BuildStatus.RED;
		}
	}

	function parseReleaseResult(result) {
		switch (result) {
			case 'failure':
				return BuildStatus.RED;
			case 'success':
				return BuildStatus.GREEN;
		}
	}

	return Promise.all(projects.map((projectName) => {
		return Promise.all([
			tfs.get(projectName + '/_apis/release/releases?$expand=environments&api-version=2.2-preview.1').then(function (project) {
				return Promise.all((project.value || []).map((release) => {
					return Promise.all(release.environments.filter(environment => ['notStarted', 'canceled'].indexOf(environment.status) === -1).map((environment) => {
						var b = new Build();

						b.id = release.id + '.' + environment.id;
						b.buildGroup = release.name;
						b.name = environment.name;
						b.status = parseReleaseStatus(environment);
						b.startedAt = new Date(release.createdOn);

						if (b.status == BuildStatus.ORANGE || b.status == BuildStatus.RED) {
							return tfs.getCached(projectName + '/_apis/release/releases/' + release.id + '/environments/' + environment.id + '/tasks?api-version=2.2-preview.1').then((details) => {
								b.steps = (details.value ||[]).filter((step) => ['failure'].indexOf(step.status) !== -1).map((step) => {
									var s = new BuildStep();

									s.name = step.name;
									s.status = parseReleaseResult(step.status);
									s.issues = (step.issues || []).filter(issue => issue.issueType === 'Error').map((issue) => issue.message);

									return s;
								});

								return b;
							}).then(() => b, () => b);
						}

						return b;
					}));
				})).then(setOfReleases => {
					var ret = [];

					for (var i=0;i<setOfReleases.length;i++) {
						ret = ret.concat(setOfReleases[i]);
					}

					return ret;
				});
			}),

			tfs.get(projectName + '/_apis/build/builds?api-version=2.0').then(function (project) {
				return Promise.all((project.value || []).map((build) => {
					var b = new Build();

					b.id = build.id;
					b.name = build.definition.name;
					b.status = parseBuildStatus(build);
					b.sourceId = build.sourceVersion;
					b.startedAt = new Date(build.startTime);

					if (build.finishTime) {
						b.finishedAt = new Date(build.finishTime);
					}

					if (build.reason === 'individualCI' || build.reason == 'batchedCI') {
						b.triggeredBy = build.requestedFor.displayName;
					}

					if (b.status == BuildStatus.ORANGE || b.status == BuildStatus.RED) {
						if (build.definition.type === 'build') {
							return tfs.getCached(build._links.timeline.href).then((details) => {
								b.steps = (details.records ||[]).filter((step) => ['failed', 'succeededWithIssues'].indexOf(step.result) !== -1 && step.parentId !== null).map((step) => {
									var s = new BuildStep();

									s.name = step.name;
									s.status = parseBuildResult(step.result);
									s.issues = (step.issues || []).filter(issue => issue.type === 'error').map((issue) => issue.message);

									return s;
								});

								return b;
							}).then(() => b, () => b);
						}
					}

					return b;
				}));
			})
		]).then(setsOfBuilds => {
			var allBuilds = [];
			var thisProjectsBuildStatusCache = (buildStatusCache[projectName] = buildStatusCache[projectName] || {});

			for (var i=0;i<setsOfBuilds.length;i++) {
				var setOfBuilds = setsOfBuilds[i];

				for (var j=setOfBuilds.length-1; j >= 0; j--) {
					switch (setOfBuilds[j].status) {
						case BuildStatus.ORANGE:
						case BuildStatus.RED:					
							thisProjectsBuildStatusCache[setOfBuilds[j].name] = setOfBuilds[j];
						break;
						case BuildStatus.GREEN:
							delete thisProjectsBuildStatusCache[setOfBuilds[j].name];
					}

					allBuilds.push(setOfBuilds[j]);
				}
			}

			return {
				builds: allBuilds,
				needsAttention: Object.keys(thisProjectsBuildStatusCache).map(key => thisProjectsBuildStatusCache[key])
			};
		});
	})).then(function (projectBuilds) {
		var ret = {
			history: [],
			queued: [],
			needsAttention: []
		};

		for (var i=0;i<projectBuilds.length;i++) {
			ret.history = ret.history.concat(projectBuilds[i].builds.filter(build => build.status != BuildStatus.IN_PROGRESS));
			ret.queued = ret.queued.concat(projectBuilds[i].builds.filter(build => build.status == BuildStatus.IN_PROGRESS));
			ret.needsAttention = ret.needsAttention.concat(projectBuilds[i].needsAttention);
		}

		function sorter(a, b) {
			return (b.finishedAt || b.startedAt) - (a.finishedAt || a.startedAt);
		}

		ret.queued.sort(sorter);
		ret.needsAttention.sort(sorter);
		ret.history.sort(sorter);
		ret.history.splice(20);

		res.json(ret).end();
	}).catch((err) => console.log(err));
});

app.listen(config.webPort, function () {
	console.log('Listening on port ' + config.webPort);
});