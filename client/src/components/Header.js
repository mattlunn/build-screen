import React, { Component } from 'react';

class Header extends Component {
	render() {
		return (
			<nav className="navbar navbar-light panel-header">
				<a className="navbar-brand" href="#"><i className={'fa fa-' + this.props.icon} /> {this.props.name}</a>
			</nav>
		);
	}
}

export default Header;