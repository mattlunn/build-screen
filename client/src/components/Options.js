import React, { Component } from 'react';
import BuildStatus from '../../../common/domain/BuildStatus';
import BuildStep from './BuildStep';
import Duration from './Duration';

class Options extends Component {
	constructor() {
		super();
		this.toggle = this.toggle.bind(this);
	}

	render() {
		return (<div className="container">
			<div className="row pb-1 pt-1">
				<div className="col-md-12">
					<h2>Choose Projects...</h2>
				</div>
			</div>
			<form action="/" method="get">
				<div className="row">
					{this.props.options.map((tfs) => {
						return (<div className="col-md-4">
							<div className="card">
								<div className="card-header">
									{tfs.name}
								</div>
								<ul className="list-group list-group-flush">
									{tfs.projects.map((project) => {
										return (<li className="list-group-item"><label><input type="checkbox" name="projects[]" value={tfs.id + ':' + project.id}/> {project.name}</label></li>);
									})}
								</ul>
							</div>
						</div>);
					})}
				</div>
				<div className="row">
					<div className="col-md-12">
						<input type="submit" className="btn btn-primary" value="Save" />
					</div>
				</div>
			</form>
		</div>);
	}

	toggle(id) {
		console.log(id);
	}
}

export default Options;