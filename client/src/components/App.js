import React, { Component } from 'react';
import Panel from './Panel';
import jQuery from 'jquery';
import Build from '../../../common/domain/Build';
import BuildStep from '../../../common/domain/BuildStep';

class App extends Component {
	constructor(props) {
		super(props);
		this.state = { panels: [], loading: true };
		this.options = this.parseOptions();
	}

	parseOptions() {
		var ret = {};
		var provided = window.location.search.slice(1).split(/&/g).reduce((prev, curr) => {
			var kvp = curr.split(/=/g);
			prev[kvp[0]] = kvp[1];
			return prev;
		}, {});

		ret.projects = provided.projects || '';
		ret.refresh = (Math.max(60, isNaN(Number(provided.refresh)) ? 60 : Number(provided.refresh))) * 1000; // Force 1 minute as quickest refresh time

		return ret;
	}

	componentDidMount() {
		this.tick();
	}

	componentWillUnmount() {
		clearTimeout(this.timer);
	}

	registerPanel(panel) {
		if (panel === null ||this.state.panels.some(x => x === panel)) return;

		this.setState({
			panels: this.state.panels.concat(panel)
		});
	}

	tick() {
		var self = this;

		jQuery.get('/data', { projects: this.options.projects, now: Date.now() }).then(function (data) {
			function createModels(builds) {
				return builds.map(props => {
					var build = new Build();

					['id', 'buildUrl', 'status', 'name', 'buildGroup', 'triggeredBy', 'triggeredByUrl', 'sourceId', 'sourceUrl'].forEach(prop => build[prop] = props[prop]);
					['finishedAt', 'startedAt'].forEach(prop => (build[prop] = props[prop] ? new Date(props[prop]) : undefined));

					build.steps = props.steps.map(props => {
						var step = new BuildStep();

						step.name = props.name;
						step.state = props.state;
						step.issues = props.issues;
						step.tests = props.tests;

						return step;
					});

					return build;
				});
			}

			for (var i=0;i<self.state.panels.length;i++) {
				var panel = self.state.panels[i];

				switch (panel.props.name) {
					case 'History':
						panel.update(createModels(data.history));
						break;
					case 'Needs Attention':
						panel.update(createModels(data.needsAttention));
						break;
					case 'Queued':
						panel.update(createModels(data.queued));
						break;
				}
			}

			self.setState({
				loading: false
			});
		}).always(() => {
			clearTimeout(this.timer);
			this.timer = setTimeout(() => this.tick(), this.options.refresh);
		});
	}

	render() {
		return (
			<div>
				{this.state.loading && <div className="loading-spinner"><i className="fa fa-spinner fa-spin" aria-hidden="true"></i></div>}

				<div className="container-fluid">
					<div className="col-sm-4">
						<Panel ref={(panel) => this.registerPanel(panel)} name="History" icon="history" />
					</div>
					<div className="col-sm-4">
						<Panel ref={(panel) => this.registerPanel(panel)} name="Needs Attention" icon="exclamation-circle" />
					</div>
					<div className="col-sm-4">
						<Panel ref={(panel) => this.registerPanel(panel)} name="Queued" icon="hourglass-start" />
					</div>
				</div>
			</div>
		);
	}
}

export default App;