'use strict';

class BuildStep {
	constructor() {
		this.name = undefined;
		this.state = undefined;
		this.issues = [];
	}
}

module.exports = BuildStep;