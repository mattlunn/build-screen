'use strict';

class BuildStatus {
	static get GREEN() {
		return 'green';
	}

	static get RED() {
		return 'red';
	}

	static get IN_PROGRESS() {
		return 'in_progress';
	}

	static get ORANGE() {
		return 'orange';
	}

	static get CANCELLED() {
		return 'cancelled';
	}
}

module.exports = BuildStatus;