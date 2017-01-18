import React, { Component } from 'react';

class Duration extends Component {
	render() {
		return (<span>{this.formatDuration(new Date() - this.props.from)}</span>);
	}

	componentDidMount() {
		var self = this;

		this.setState({
			interval: setInterval(() => self.forceUpdate(), 1000)
		});
	}

	componentWillUnmount() {
		clearInterval(this.state.interval);
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
}

export default Duration;