import Item from '@enact/moonstone/Item';
import {VirtualListBase as UiVirtualListBase} from '@enact/ui/VirtualList';
import VirtualList, {VirtualListBase} from '@enact/moonstone/VirtualList';
import ri from '@enact/ui/resolution';
import React from 'react';
import {storiesOf} from '@storybook/react';
import {action} from '@storybook/addon-actions';
import {boolean, number} from '@storybook/addon-knobs';
import {withInfo} from '@storybook/addon-info';

import nullify from '../../src/utils/nullify.js';
import {mergeComponentMetadata} from '../../src/utils/propTables';

const Config = mergeComponentMetadata('VirtualList', VirtualList, VirtualListBase, UiVirtualListBase);

const items = [];

for (let i = 0; i < 1000; i++) {
	items.push('Item ' + ('00' + i).slice(-3));
}

class A extends React.Component {
	onScrollStop = ({moreInfo: {firstVisibleIndex, lastVisibleIndex}}) => {
		this.firstVisibleIndex = firstVisibleIndex;
		this.lastVisibleIndex = lastVisibleIndex;

		setTimeout(() => {
			this.forceUpdate();
		}, 1);
	}

	// eslint-disable-next-line enact/prop-types, enact/display-name
	renderItem = (size) => ({index, ...rest}) => {
		const itemStyle = {
			height: size + 'px',
			borderBottom: ri.unit(3, 'rem') + ' solid #202328',
			boxSizing: 'border-box'
		};

		return (
			<Item
				{...rest}
				data-screen-index={
					(index >= this.firstVisibleIndex && index <= this.firstVisibleIndex) ?
						index - this.firstVisibleIndex + 1 :
						null
				}
				style={itemStyle}
			>
				{items[index]}
			</Item>
		);
	}

	render () {
		const itemSize = ri.scale(number('itemSize', 72));

		return (
			<VirtualList
				dataSize={number('dataSize', items.length)}
				focusableScrollbar={nullify(boolean('focusableScrollbar', false))}
				itemRenderer={this.renderItem(itemSize)}
				itemSize={itemSize}
				onScrollStart={action('onScrollStart')}
				onScrollStop={this.onScrollStop}
				spacing={ri.scale(number('spacing', 0))}
				style={{
					height: ri.unit(552, 'rem')
				}}
			/>
		);
	}
}

storiesOf('Moonstone', module)
	.add(
		'VirtualList',
		withInfo({
			propTables: [Config],
			text: 'Basic usage of VirtualList'
		})(() => (<A />))
	);
