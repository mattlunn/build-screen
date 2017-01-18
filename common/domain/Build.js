'use strict';

class Build {
	constructor() {
		this.id = undefined;
		this.buildGroup = undefined;
		this.buildUrl = undefined;
		this.status = undefined;
		this.name = undefined;
		this.finishedAt = undefined;
		this.startedAt = undefined;
		this.triggeredBy = undefined;
		this.triggeredByUrl = undefined;
		this.sourceId = undefined;
		this.sourceUrl = undefined;
		this.steps = [];
	}

	get duration() {
		return (this.finishedAt || new Date()) - this.startedAt;
	}
}

module.exports = Build;