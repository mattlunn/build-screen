'use strict';

const fs = require('fs');
const path = require('path');
const config = require('./config');
const express = require('express');
const tfs = require('./tfs');
const tfsInstances = config.tfs.reduce((last, curr) => (last[curr.id] = tfs.create(curr.url, curr.collection, curr.credentials)) && last, {});
const app = express();
const Build = require('../common/domain/Build');
const BuildStep = require('../common/domain/BuildStep');
const BuildStatus = require('../common/domain/BuildStatus');
const Project = require('../common/domain/Project');
const buildStatusCache = {};

app.use(express.static(__dirname + '/../client/build'));

app.get('/', function (req, res) {
	res.sendFile(path.join(__dirname, '../client/build', 'index.html'));
});

app.get('/projects', function (req, res, next) {
	Promise.all(config.tfs.map((settings) => {
		var tfsInstance = tfsInstances[settings.id];

		return tfsInstance.get(tfsInstance.endpoints.projects, '_apis/projects').then((projects) => {
			return {
				id: settings.id,
				name: settings.name,
				projects: projects.value.map((project) => new Project(project.id, project.name, project.description))
			};
		});
	})).then((data) => {
		res.json(data).end();
	}).catch((err) => {
		console.log(err);
		next(err);
	});
});

// What follows is the biggest abuse of JavaScript the world has ever seen. I should be shot. I apologise.
app.get('/data', function (req, res) {
	var projects = (req.query.projects || '').split(/[;,]/g).filter(project => project.length);

	function parseBuildStatus(build) {
		switch (build.status) {
			case 'notStarted':
				return BuildStatus.QUEUED;
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
			case 'notStarted':
				return BuildStatus.QUEUED;
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

	return Promise.all(projects.map((tfsInstanceAndprojectName) => {
		var [tfsInstanceId, projectName] = tfsInstanceAndprojectName.split(/:/);
		var tfsInstance = tfsInstances[tfsInstanceId];

		if (typeof tfsInstance === 'undefined') {
			return {
				builds: [],
				needsAttention: []
			};
		}

		return tfsInstance.get(tfsInstance.endpoints.test, projectName + '/_apis/test/runs?api-version=1.0&includerundetails=true').then(function (testRuns) {
			var runsLookup = {
				releases: {},
				builds: {}
			};

			for (var i=0;i<testRuns.value.length;i++) {
				var run = testRuns.value[i];

				if (run.hasOwnProperty('releaseUri')) {
					var releaseId = run.releaseUri.split('/').pop();
					var environmentId = run.releaseEnvironmentUri.split('/').pop();

					runsLookup.releases[releaseId] = runsLookup.releases[releaseId] || {};
					runsLookup.releases[releaseId][environmentId] = runsLookup.releases[releaseId][environmentId] || [];
					runsLookup.releases[releaseId][environmentId].push(run);
				} else if (run.hasOwnProperty('build')) {
					runsLookup.builds[run.build.id] = runsLookup.builds[run.build.id] || [];
					runsLookup.builds[run.build.id].push(run);
				}
			}

			return runsLookup;
		}).then((runsLookup) => {
			function addMatchingTestResults(buildStep, runs, response) {
				if (runs.length === 1) {
					var run = runs[0];

					buildStep.tests = {
						total: run.totalTests || 0,
						passed: run.passedTests || 0,
						ignored: run.notApplicableTests || 0,
						failed: run.totalTests - run.passedTests - run.notApplicableTests
					};
				}
			}

			function addAnyMatchingTestResultsForReleaseStep(buildStep, releaseId, environmentId, response) {
				if (runsLookup.releases.hasOwnProperty(releaseId) && runsLookup.releases[releaseId].hasOwnProperty(environmentId)) {
					addMatchingTestResults(
						buildStep,
						runsLookup.releases[releaseId][environmentId].filter(run => run.startedDate > response.dateStarted && run.completedDate < response.dateEnded),
						response);
				}
			}

			function addAnyMatchingTestResultsForBuild(buildStep, buildId, response) {
				if (runsLookup.builds.hasOwnProperty(buildId)) {
					addMatchingTestResults(
						buildStep,
						runsLookup.builds[buildId].filter(run => run.startedDate > response.startTime && run.completedDate < response.finishTime),
						response);
				}
			}

			return Promise.all([
				tfsInstance.get(tfsInstance.endpoints.release, projectName + '/_apis/release/releases?$expand=environments&api-version=2.2-preview.1').then(function (project) {
					return Promise.all((project.value || []).map((release) => {
						return Promise.all(release.environments.filter(environment => ['notStarted', 'canceled'].indexOf(environment.status) === -1).map((environment) => {
							var b = new Build();

							b.id = release.id + '.' + environment.id;
							b.buildGroup = release.name;
							b.name = environment.name;
							b.status = parseReleaseStatus(environment);
							b.startedAt = new Date(release.createdOn);

							if (b.status == BuildStatus.ORANGE || b.status == BuildStatus.RED) {
								return tfsInstance.getCached(tfsInstance.endpoints.release, projectName + '/_apis/release/releases/' + release.id + '/environments/' + environment.id + '/tasks?api-version=2.2-preview.1').then((details) => {
									b.steps = (details.value ||[]).filter((step) => ['failure', 'failed'].indexOf(step.status) !== -1).map((step) => {
										var s = new BuildStep();

										s.name = step.name;
										s.status = parseReleaseResult(step.status);
										s.issues = (step.issues || []).filter(issue => issue.issueType === 'Error').map((issue) => issue.message);

										addAnyMatchingTestResultsForReleaseStep(s, release.id, environment.id, step);

										return s;
									});

									return b;
								}).then(() => b, (e) => { console.log(e); return b; });
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
				}).then(null, (err) => {
					console.log(err);
					return [];
				}),

				tfsInstance.get(tfsInstance.endpoints.build, projectName + '/_apis/build/builds?api-version=2.0').then(function (project) {
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

						if (['individualCI', 'batchedCI', 'manual'].indexOf(build.reason) !== -1) {
							b.triggeredBy = build.requestedFor.displayName;
						}

						if (b.status == BuildStatus.ORANGE || b.status == BuildStatus.RED) {
							if (build.definition.type === 'build') {
								return tfsInstance.getCached(tfsInstance.endpoints.build, build._links.timeline.href).then((details) => {
									b.steps = (details.records ||[]).filter((step) => ['failed', 'succeededWithIssues'].indexOf(step.result) !== -1 && step.parentId !== null).map((step) => {
										var s = new BuildStep();

										s.name = step.name;
										s.status = parseBuildResult(step.result);
										s.issues = (step.issues || []).filter(issue => issue.type === 'error').map((issue) => issue.message);

										addAnyMatchingTestResultsForBuild(s, build.id, step);

										return s;
									});

									return b;
								}).then(() => b, () => b);
							}
						}

						return b;
					}));
				}).then(null, (err) => {
					console.log(err);
					return [];
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
		});
	})).then(function (projectBuilds) {
		var ret = {
			history: [],
			queued: [],
			needsAttention: []
		};

		for (var i=0;i<projectBuilds.length;i++) {
			ret.history = ret.history.concat(projectBuilds[i].builds.filter(build => build.status != BuildStatus.IN_PROGRESS && build.status != BuildStatus.QUEUED));
			ret.queued = ret.queued.concat(projectBuilds[i].builds.filter(build => build.status == BuildStatus.IN_PROGRESS || build.status == BuildStatus.QUEUED));
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
	}).catch((err) => {
		console.log(err);
		res.status(500).end();
	});
});

app.listen(config.webPort, function () {
	console.log('Listening on port ' + config.webPort);
});