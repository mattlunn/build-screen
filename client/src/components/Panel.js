import React, { Component } from 'react';
import Header from './Header';
import Build from './Build';

class Panel extends Component {
	constructor(props) {
		super(props);

		this.state = { counter: 0, items: [] };
	}

	render() {
		return (
			<div>
				<Header name={this.props.name} icon={this.props.icon} />
				{this.state.items.map((item, i) => <Build key={i} build={item} />)}
			</div>
		);
	}

	update(items) {
		this.setState({
			items: items
		});
	}
}

export default Panel;