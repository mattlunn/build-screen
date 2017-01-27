import React, { Component } from 'react';
import BuildStatus from '../../../common/domain/BuildStatus';

class BuildStep extends Component {
	render() {
		return (<div>
			<div className={this.determineColor(this.props.status)}>{this.props.name}</div>
			<ul className="build-failure-info">
				{this.props.issues.map((issue, i) => (<li key={i}><span>{issue}</span></li>))}

				{this.props.tests && (<li><span>{this.props.tests.failed} failed, {this.props.tests.passed} passed, {this.props.tests.ignored} ignored</span></li>)}
			</ul>
		</div>);
	}

	determineColor(status) {
		switch (status) {
			case BuildStatus.RED:
				return 'text-danger';
			case BuildStatus.ORANGE:
				return 'text-warning';
		}
	}
}

export default BuildStep;