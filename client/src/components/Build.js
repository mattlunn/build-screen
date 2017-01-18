import React, { Component } from 'react';
import BuildStatus from '../../../common/domain/BuildStatus';
import BuildStep from './BuildStep';
import Duration from './Duration';

class Build extends Component {
	render() {
		var b = this.props.build;

		return (
			<div className={'card card-outline-' + this.chooseBorderColor(b.status) + ' history-item'}>
				<div className="card-block">
					<h4>{b.name}</h4>
					{b.sourceId && (<p><a href="#">{b.id}</a> was started {this.formatTriggeredBy(b)}, using source version <a href="#">{b.sourceId}</a></p>)}
					{b.buildGroup && (<p>Part of <a href="#">{b.buildGroup}</a></p>)}

					{b.status !== BuildStatus.GREEN && b.steps.map((step, i) => <BuildStep name={step.name} key={i} status={step.status} issues={step.issues} />)}
					
					<div className="text-muted">{this.formatTime(b)}</div>
				</div>
			</div>
		);
	}

	formatTime(build) {
		if (build.status === BuildStatus.IN_PROGRESS) {
			return (<span>Running for <Duration from={build.startedAt} /></span>);
		}

		if (build.finishedAt) {
			return (<span>Finished <Duration from={build.finishedAt} /> ago (took {this.formatDuration(build.duration)})</span>);
		}

		return (<span>Started <Duration from={build.startedAt} /> ago</span>);
	}

	formatTriggeredBy(build) {
		return build.triggeredBy
			? (<span>by <a href="#">{build.triggeredBy}</a></span>)
			: 'automatically';
	}

	formatDuration(input) {
		var duration = input / 1000;

		var components = [];
		var map = {
			d: 60 * 60 * 24,
			h: 60 * 60,
			m: 60,
			s: 1
		};

		for (var x in map) {
			var amount = Math.floor(duration / map[x]);

			if (amount > 0) {
				components.push(amount + x);
				duration -= amount * map[x];
			}
		}

		return components.splice(0, 3).join(' ');
	}

	chooseBorderColor(color) {
		switch (color) {
			case BuildStatus.RED:
				return 'danger';
			case BuildStatus.ORANGE:
				return 'warning';
			case BuildStatus.IN_PROGRESS:
				return 'info';
			default:
				return 'success';
		}
	}
}

export default Build;