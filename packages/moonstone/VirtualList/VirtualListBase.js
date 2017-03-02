/*
 * Exports the {@link moonstone/VirtualList.VirtualListBase} and
 * {@link moonstone/VirtualList.VirtualListCore} components and the
 * {@link moonstone/VirtualList.gridListItemSizeShape} validator. The default
 * export is {@link moonstone/VirtualList.VirtualListBase}.
 */

import classNames from 'classnames';
import {contextTypes} from '@enact/i18n/I18nDecorator';
import {is} from '@enact/core/keymap';
import React, {Component, PropTypes} from 'react';
import {Spotlight, SpotlightContainerDecorator} from '@enact/spotlight';

import {dataIndexAttribute, Scrollable} from '../Scroller/Scrollable';

import css from './ListItem.less';

const
	dataContainerMutedAttribute = 'data-container-muted',
	dataContainerIdAttribute = 'data-container-id',
	isDown = is('down'),
	isLeft = is('left'),
	isRight = is('right'),
	isUp = is('up'),
	nop = () => {};

/**
 * The shape for the grid list item size in a list for {@link moonstone/VirtualList.listItemSizeShape}.
 *
 * @typedef {Object} gridListItemSizeShape
 * @memberof moonstone/VirtualList
 * @property {Number} minWidth - The minimum width of the grid list item.
 * @property {Number} minHeight - The minimum height of the grid list item.
 */
const gridListItemSizeShape = PropTypes.shape({
	minWidth: PropTypes.number.isRequired,
	minHeight:  PropTypes.number.isRequired
});

/**
 * {@link moonstone/VirtualList.VirtualListBase} is a base component for
 * {@link moonstone/VirtualList.VirtualList} and
 * {@link moonstone/VirtualList.VirtualGridList} with Scrollable and SpotlightContainerDecorator applied.
 *
 * @class VirtualListCore
 * @memberof moonstone/VirtualList
 * @ui
 * @private
 */
class VirtualListCore extends Component {
	static propTypes = /** @lends moonstone/VirtualList.VirtualListCore.prototype */ {
		/**
		 * The render function for an item of the list.
		 * `index` is for accessing the index of the item.
		 * `key` MUST be passed as a prop for DOM recycling.
		 * Data manipulation can be done in this function.
		 *
		 * @type {Function}
		 * @public
		 */
		component: PropTypes.func.isRequired,

		/**
		 * Size of an item for the list; valid values are either a number for `VirtualList`
		 * or an object that has `minWidth` and `minHeight` for `VirtualGridList`.
		 *
		 * @type {Number|moonstone/VirtualList.gridListItemSizeShape}
		 * @public
		 */
		itemSize: PropTypes.oneOfType([
			PropTypes.number,
			gridListItemSizeShape
		]).isRequired,

		/**
		 * Callback method of scrollTo.
		 * Normally, `Scrollable` should set this value.
		 *
		 * @type {Function}
		 * @private
		 */
		cbScrollTo: PropTypes.func,

		/**
		 * Data for the list.
		 * Check mutation of this and determine whether the list should update or not.
		 *
		 * @type {Any}
		 * @default []
		 * @public
		 */
		data: PropTypes.any,

		/**
		 * Size of the data.
		 *
		 * @type {Number}
		 * @default 0
		 * @public
		 */
		dataSize: PropTypes.number,

		/**
		 * Direction of the list; valid values are `'horizontal'` and `'vertical'`.
		 *
		 * @type {String}
		 * @default 'vertical'
		 * @public
		 */
		direction: PropTypes.oneOf(['horizontal', 'vertical']),

		/**
		 * Called when onScroll [events]{@glossary event} occurs.
		 *
		 * @type {Function}
		 * @private
		 */
		onScroll: PropTypes.func,

		/**
		 * Number of spare DOM node.
		 * `3` is good for the default value experimentally and
		 * this value is highly recommended not to be changed by developers.
		 *
		 * @type {Number}
		 * @default 3
		 * @private
		 */
		overhang: PropTypes.number,

		/**
		 * It scrolls by page when 'true', by item when 'false'
		 *
		 * @type {Boolean}
		 * @default false
		 * @private
		 */
		pageScroll: PropTypes.bool,

		/**
		 * Option for positioning the items; valid values are `'byItem'`, `'byContainer'`,
		 * and `'byBrowser'`.
		 * If `'byItem'`, the list moves each item.
		 * If `'byContainer'`, the list moves the container that contains rendered items.
		 * If `'byBrowser'`, the list scrolls by browser.
		 *
		 * @type {String}
		 * @default 'byItem'
		 * @private
		 */
		positioningOption: PropTypes.oneOf(['byItem', 'byContainer', 'byBrowser']),

		/**
		 * Spacing between items.
		 *
		 * @type {Number}
		 * @default 0
		 * @public
		 */
		spacing: PropTypes.number
	}

	static contextTypes = contextTypes

	static defaultProps = {
		cbScrollTo: nop,
		data: [],
		dataSize: 0,
		direction: 'vertical',
		onScroll: nop,
		overhang: 3,
		pageScroll: false,
		positioningOption: 'byItem',
		spacing: 0,
		style: {}
	}

	constructor (props) {
		const {positioningOption} = props;

		super(props);

		this.state = {firstIndex: 0, numOfItems: 0};
		this.initContainerRef = this.initRef('containerRef');
		this.initWrapperRef = this.initRef('wrapperRef');

		switch (positioningOption) {
			case 'byItem':
				this.composeItemPosition = this.composeTransform;
				this.positionContainer = nop;
				break;
			case 'byContainer':
				this.composeItemPosition = this.composeLeftTop;
				this.positionContainer = this.applyTransformToContainerNode;
				break;
			case 'byBrowser':
				this.composeItemPosition = this.composeLeftTop;
				this.positionContainer = this.applyScrollLeftTopToWrapperNode;
				break;
		}
	}

	// Calculate metrics for VirtualList after the 1st render to know client W/H.
	// We separate code related with data due to re use it when data changed.
	componentDidMount () {
		const {positioningOption} = this.props;

		this.calculateMetrics(this.props);
		this.updateStatesAndBounds(this.props);

		if (positioningOption !== 'byBrowser') {
			const containerNode = this.getContainerNode(positioningOption);

			// prevent native scrolling by Spotlight
			this.preventScroll = () => {
				containerNode.scrollTop = 0;
				containerNode.scrollLeft = this.context.rtl ? containerNode.scrollWidth : 0;
			};

			if (containerNode && containerNode.addEventListener) {
				containerNode.addEventListener('scroll', this.preventScroll);
			}
		}
	}

	// Call updateStatesAndBounds here when dataSize has been changed to update nomOfItems state.
	// Calling setState within componentWillReceivePropswill not trigger an additional render.
	componentWillReceiveProps (nextProps) {
		const
			{dataSize, direction, itemSize, overhang, spacing} = this.props,
			hasMetricsChanged = (
				direction !== nextProps.direction ||
				((itemSize instanceof Object) ? (itemSize.minWidth !== nextProps.itemSize.minWidth || itemSize.minHeight !== nextProps.itemSize.minHeight) : itemSize !== nextProps.itemSize) ||
				overhang !== nextProps.overhang ||
				spacing !== nextProps.spacing
			),
			hasDataChanged = (dataSize !== nextProps.dataSize);

		if (hasMetricsChanged) {
			this.calculateMetrics(nextProps);
			this.updateStatesAndBounds(hasDataChanged ? nextProps : this.props);
		} else if (hasDataChanged) {
			this.updateStatesAndBounds(nextProps);
		}
	}

	componentWillUnmount () {
		const containerNode = this.getContainerNode(this.props.positioningOption);

		// remove a function for preventing native scrolling by Spotlight
		if (containerNode && containerNode.removeEventListener) {
			containerNode.removeEventListener('scroll', this.preventScroll);
		}
	}

	scrollBounds = {
		clientWidth: 0,
		clientHeight: 0,
		scrollWidth: 0,
		scrollHeight: 0,
		maxLeft: 0,
		maxTop: 0
	}

	moreInfo = {
		firstVisibleIndex: null,
		lastVisibleIndex: null
	}

	primary = null
	secondary = null

	isPrimaryDirectionVertical = true
	isItemSized = false

	dimensionToExtent = 0
	threshold = 0
	maxFirstIndex = 0
	curDataSize = 0
	cc = []
	scrollPosition = 0
	updateFrom = null
	updateTo = null

	containerRef = null
	wrapperRef = null
	composeItemPosition = null
	positionContainer = null

	// spotlight
	nodeIndexToBeBlurred = null
	lastFocusedIndex = null

	isVertical = () => this.isPrimaryDirectionVertical

	isHorizontal = () => !this.isPrimaryDirectionVertical

	getScrollBounds = () => this.scrollBounds

	getMoreInfo = () => this.moreInfo

	getGridPosition (index) {
		const
			{dimensionToExtent, primary, secondary} = this,
			primaryPosition = Math.floor(index / dimensionToExtent) * primary.gridSize,
			secondaryPosition = (index % dimensionToExtent) * secondary.gridSize;

		return {primaryPosition, secondaryPosition};
	}

	getItemPosition = (index) => this.gridPositionToItemPosition(this.getGridPosition(index))

	gridPositionToItemPosition = ({primaryPosition, secondaryPosition}) =>
		(this.isPrimaryDirectionVertical ? {left: secondaryPosition, top: primaryPosition} : {left: primaryPosition, top: secondaryPosition})

	getContainerNode = (positioningOption) => {
		if (positioningOption === 'byItem') {
			return this.containerRef;
		} else {
			return this.wrapperRef;
		}
	}

	getClientSize = (node) => {
		return {
			clientWidth: node.clientWidth,
			clientHeight: node.clientHeight
		};
	}

	calculateMetrics (props) {
		const
			{direction, itemSize, positioningOption, spacing} = props,
			node = this.getContainerNode(positioningOption);

		if (!node) {
			return;
		}

		const
			{clientWidth, clientHeight} = this.getClientSize(node),
			heightInfo = {
				clientSize: clientHeight,
				minItemSize: itemSize.minHeight || null,
				itemSize: itemSize
			},
			widthInfo = {
				clientSize: clientWidth,
				minItemSize: itemSize.minWidth || null,
				itemSize: itemSize
			};
		let primary, secondary, dimensionToExtent, thresholdBase;

		this.isPrimaryDirectionVertical = (direction === 'vertical');

		if (this.isPrimaryDirectionVertical) {
			primary = heightInfo;
			secondary = widthInfo;
		} else {
			primary = widthInfo;
			secondary = heightInfo;
		}
		dimensionToExtent = 1;

		this.isItemSized = (primary.minItemSize && secondary.minItemSize);

		if (this.isItemSized) {
			// the number of columns is the ratio of the available width plus the spacing
			// by the minimum item width plus the spacing
			dimensionToExtent = Math.max(Math.floor((secondary.clientSize + spacing) / (secondary.minItemSize + spacing)), 1);
			// the actual item width is a ratio of the remaining width after all columns
			// and spacing are accounted for and the number of columns that we know we should have
			secondary.itemSize = Math.round((secondary.clientSize - (spacing * (dimensionToExtent - 1))) / dimensionToExtent);
			// the actual item height is related to the item width
			primary.itemSize = Math.round(primary.minItemSize * (secondary.itemSize / secondary.minItemSize));
		}

		primary.gridSize = primary.itemSize + spacing;
		secondary.gridSize = secondary.itemSize + spacing;
		thresholdBase = primary.gridSize * 2;

		this.threshold = {min: -Infinity, max: thresholdBase, base: thresholdBase};
		this.dimensionToExtent = dimensionToExtent;

		this.primary = primary;
		this.secondary = secondary;

		// reset
		this.scrollPosition = 0;
		// eslint-disable-next-line react/no-direct-mutation-state
		this.state.firstIndex = 0;
		// eslint-disable-next-line react/no-direct-mutation-state
		this.state.numOfItems = 0;
	}

	updateStatesAndBounds (props) {
		const
			{dataSize, overhang} = props,
			{dimensionToExtent, primary} = this,
			numOfItems = Math.min(dataSize, dimensionToExtent * (Math.ceil(primary.clientSize / primary.gridSize) + overhang));

		this.maxFirstIndex = dataSize - numOfItems;
		this.curDataSize = dataSize;
		this.updateFrom = null;
		this.updateTo = null;

		// reset children
		this.cc = [];

		this.setState({firstIndex: Math.min(this.state.firstIndex, this.maxFirstIndex), numOfItems});
		this.calculateScrollBounds(props);
	}

	calculateScrollBounds (props) {
		const node = this.getContainerNode(props.positioningOption);

		if (!node) {
			return;
		}

		const
			{clientWidth, clientHeight} = this.getClientSize(node),
			{scrollBounds, isPrimaryDirectionVertical} = this;
		let maxPos;

		scrollBounds.clientWidth = clientWidth;
		scrollBounds.clientHeight = clientHeight;
		scrollBounds.scrollWidth = this.getScrollWidth();
		scrollBounds.scrollHeight = this.getScrollHeight();
		scrollBounds.maxLeft = Math.max(0, scrollBounds.scrollWidth - clientWidth);
		scrollBounds.maxTop = Math.max(0, scrollBounds.scrollHeight - clientHeight);

		// correct position
		maxPos = isPrimaryDirectionVertical ? scrollBounds.maxTop : scrollBounds.maxLeft;

		this.syncThreshold(maxPos);

		if (this.scrollPosition > maxPos) {
			this.props.cbScrollTo({position: (isPrimaryDirectionVertical) ? {y: maxPos} : {x: maxPos}});
		}
	}

	syncThreshold (maxPos) {
		const {threshold} = this;

		if (threshold.max > maxPos) {
			if (maxPos < threshold.base) {
				threshold.max = threshold.base;
				threshold.min = -Infinity;
			} else {
				threshold.max = maxPos;
				threshold.min = maxPos - threshold.base;
			}
		}
	}

	setScrollPosition (x, y, dirX, dirY, skipPositionContainer = false) {
		const
			{firstIndex} = this.state,
			{isPrimaryDirectionVertical, threshold, dimensionToExtent, maxFirstIndex, scrollBounds} = this,
			{gridSize} = this.primary,
			maxPos = isPrimaryDirectionVertical ? scrollBounds.maxTop : scrollBounds.maxLeft,
			minOfMax = threshold.base,
			maxOfMin = maxPos - minOfMax;
		let
			delta, numOfGridLines, newFirstIndex = firstIndex, pos, dir = 0;

		if (isPrimaryDirectionVertical) {
			pos = y;
			dir = dirY;
		} else {
			pos = x;
			dir = dirX;
		}

		if (dir === 1 && pos > threshold.max) {
			delta = pos - threshold.max;
			numOfGridLines = Math.ceil(delta / gridSize); // how many lines should we add
			threshold.max = Math.min(maxPos, threshold.max + numOfGridLines * gridSize);
			threshold.min = Math.min(maxOfMin, threshold.max - gridSize);
			newFirstIndex = Math.min(maxFirstIndex, (dimensionToExtent * Math.ceil(firstIndex / dimensionToExtent)) + (numOfGridLines * dimensionToExtent));
		} else if (dir === -1 && pos < threshold.min) {
			delta = threshold.min - pos;
			numOfGridLines = Math.ceil(delta / gridSize);
			threshold.max = Math.max(minOfMax, threshold.min - (numOfGridLines * gridSize - gridSize));
			threshold.min = (threshold.max > minOfMax) ? threshold.max - gridSize : -Infinity;
			newFirstIndex = Math.max(0, (dimensionToExtent * Math.ceil(firstIndex / dimensionToExtent)) - (numOfGridLines * dimensionToExtent));
		}

		this.syncThreshold(maxPos);
		this.scrollPosition = pos;

		if (!skipPositionContainer) {
			this.positionContainer();
		}

		if (firstIndex !== newFirstIndex) {
			this.setState({firstIndex: newFirstIndex});
		} else {
			this.positionItems(this.determineUpdatedNeededIndices(firstIndex));
		}
	}

	determineUpdatedNeededIndices (oldFirstIndex) {
		const
			{positioningOption} = this.props,
			{firstIndex, numOfItems} = this.state;

		if (positioningOption === 'byItem') {
			return {
				updateFrom: firstIndex,
				updateTo: firstIndex + numOfItems
			};
		} else {
			const diff = firstIndex - oldFirstIndex;
			return {
				updateFrom: (0 < diff && diff < numOfItems ) ? oldFirstIndex + numOfItems : firstIndex,
				updateTo: (-numOfItems < diff && diff <= 0 ) ? oldFirstIndex : firstIndex + numOfItems
			};
		}
	}

	applyStyleToExistingNode = (primaryIndex, ...rest) => {
		const
			{numOfItems} = this.state,
			node = this.containerRef.children[primaryIndex % numOfItems];

		if (node) {
			if ((primaryIndex % numOfItems) === this.nodeIndexToBeBlurred && primaryIndex !== this.lastFocusedIndex) {
				node.blur();
				this.nodeIndexToBeBlurred = null;
			}
			this.composeStyle(node.style, ...rest);
		}
	}

	applyStyleToNewNode = (primaryIndex, ...rest) => {
		const
			{component, data} = this.props,
			{numOfItems} = this.state,
			itemElement = component({
				data,
				[dataIndexAttribute]: primaryIndex,
				index: primaryIndex,
				key: primaryIndex % numOfItems
			}),
			style = {};

		this.composeStyle(style, ...rest);

		this.cc[primaryIndex % numOfItems] = React.cloneElement(itemElement, {
			className: classNames(css.listItem, itemElement.props.className),
			style: {...itemElement.props.style, ...style}
		});
	}

	positionItems ({updateFrom, updateTo}) {
		const
			{positioningOption} = this.props,
			{isPrimaryDirectionVertical, dimensionToExtent, moreInfo, primary, secondary, scrollPosition} = this;

		// we only calculate position of the first child
		let
			{primaryPosition, secondaryPosition} = this.getGridPosition(updateFrom),
			firstVisibleIndex = null, lastVisibleIndex = null,
			width, height;

		primaryPosition -= (positioningOption === 'byItem') ? scrollPosition : 0;
		width = (isPrimaryDirectionVertical ? secondary.itemSize : primary.itemSize) + 'px';
		height = (isPrimaryDirectionVertical ? primary.itemSize : secondary.itemSize) + 'px';

		// positioning items
		for (let primaryIndex = updateFrom, secondaryIndex = updateFrom % dimensionToExtent; primaryIndex < updateTo; primaryIndex++) {

			// determine the first and the last visible item
			if (firstVisibleIndex === null && (primaryPosition + primary.itemSize) > 0) {
				firstVisibleIndex = primaryIndex;
			}
			if (primaryPosition < primary.clientSize) {
				lastVisibleIndex = primaryIndex;
			}
			if (this.updateFrom === null || this.updateTo === null || this.updateFrom > primaryIndex || this.updateTo <= primaryIndex) {
				this.applyStyleToNewNode(primaryIndex, width, height, primaryPosition, secondaryPosition);
			} else {
				this.applyStyleToExistingNode(primaryIndex, width, height, primaryPosition, secondaryPosition);
			}

			if (++secondaryIndex === dimensionToExtent) {
				secondaryPosition = 0;
				primaryPosition += primary.gridSize;
				secondaryIndex = 0;
			} else {
				secondaryPosition += secondary.gridSize;
			}
		}

		this.updateFrom = updateFrom;
		this.updateTo = updateTo;
		moreInfo.firstVisibleIndex = firstVisibleIndex;
		moreInfo.lastVisibleIndex = lastVisibleIndex;
	}

	composeStyle (style, width, height, ...rest) {
		if (this.isItemSized) {
			style.width = width;
			style.height = height;
		}
		this.composeItemPosition(style, ...rest);
	}

	getXY = (primaryPosition, secondaryPosition) => {
		const rtlDirection = this.context.rtl ? -1 : 1;
		return (this.isPrimaryDirectionVertical ? {x: (secondaryPosition * rtlDirection), y: primaryPosition} : {x: (primaryPosition * rtlDirection), y: secondaryPosition});
	}

	composeTransform (style, primaryPosition, secondaryPosition = 0) {
		const {x, y} = this.getXY(primaryPosition, secondaryPosition);

		style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
	}

	composeLeftTop (style, primaryPosition, secondaryPosition = 0) {
		const {x, y} = this.getXY(primaryPosition, secondaryPosition);

		style.left = x + 'px';
		style.top = y + 'px';
	}

	applyTransformToContainerNode () {
		this.composeTransform(this.containerRef.style, -this.scrollPosition, 0);
	}

	applyScrollLeftTopToWrapperNode () {
		const
			node = this.wrapperRef,
			{x, y} = this.getXY(this.scrollPosition, 0);
		node.scrollLeft = x;
		node.scrollTop = y;
	}

	composeOverflow (style) {
		style[this.isPrimaryDirectionVertical ? 'overflowY' : 'overflowX'] = 'scroll';
	}

	getScrollHeight = () => (this.isPrimaryDirectionVertical ? this.getVirtualScrollDimension() : this.scrollBounds.clientHeight)

	getScrollWidth = () => (this.isPrimaryDirectionVertical ? this.scrollBounds.clientWidth : this.getVirtualScrollDimension())

	getVirtualScrollDimension = () => {
		const
			{dimensionToExtent, primary, curDataSize} = this,
			{spacing} = this.props;

		return (Math.ceil(curDataSize / dimensionToExtent) * primary.gridSize) - spacing;
	}

	calculatePositionOnFocus = (item) => {
		const
			{pageScroll} = this.props,
			{primary, numOfItems, scrollPosition} = this,
			offsetToClientEnd = primary.clientSize - primary.itemSize,
			focusedIndex = Number.parseInt(item.getAttribute(dataIndexAttribute));

		if (!isNaN(focusedIndex)) {
			let
				gridPosition = this.getGridPosition(focusedIndex);

			this.nodeIndexToBeBlurred = this.lastFocusedIndex % numOfItems;
			this.lastFocusedIndex = focusedIndex;

			if (primary.clientSize >= primary.itemSize) {
				if (gridPosition.primaryPosition > scrollPosition + offsetToClientEnd) { // forward over
					gridPosition.primaryPosition -= pageScroll ? 0 : offsetToClientEnd;
				} else if (gridPosition.primaryPosition >= scrollPosition) { // inside of client
					gridPosition.primaryPosition = scrollPosition;
				} else { // backward over
					gridPosition.primaryPosition -= pageScroll ? offsetToClientEnd : 0;
				}
			}

			// Since the result is used as a target position to be scrolled,
			// scrondaryPosition should be 0 here.
			gridPosition.secondaryPosition = 0;
			return this.gridPositionToItemPosition(gridPosition);
		}
	}

	setRestrict = (bool) => {
		Spotlight.set(this.props[dataContainerIdAttribute], {restrict: (bool) ? 'self-only' : 'self-first'});
	}

	setSpotlightContainerRestrict = (keyCode, index) => {
		const
			{dataSize} = this.props,
			{isPrimaryDirectionVertical, dimensionToExtent} = this,
			canMoveBackward = index >= dimensionToExtent,
			canMoveForward = index < (dataSize - (((dataSize - 1) % dimensionToExtent) + 1));
		let isSelfOnly = false;

		if (isPrimaryDirectionVertical) {
			if (isUp(keyCode) && canMoveBackward || isDown(keyCode) && canMoveForward) {
				isSelfOnly = true;
			}
		} else if (isLeft(keyCode) && canMoveBackward || isRight(keyCode) && canMoveForward) {
			isSelfOnly = true;
		}

		this.setRestrict(isSelfOnly);
	}

	setContainerDisabled = (bool) => {
		const containerNode = this.getContainerNode(this.props.positioningOption);

		if (containerNode) {
			containerNode.setAttribute(dataContainerMutedAttribute, bool);
		}
	}

	syncClientSize = () => {
		const
			{props} = this,
			node = this.getContainerNode(props.positioningOption);

		if (!node) {
			return;
		}

		const
			{clientWidth, clientHeight} = this.getClientSize(node),
			{scrollBounds} = this;

		if (clientWidth !== scrollBounds.clientWidth || clientHeight !== scrollBounds.clientHeight) {
			this.calculateMetrics(props);
			this.updateStatesAndBounds(props);
		}
	}

	// render

	initRef (prop) {
		return (ref) => {
			this[prop] = ref;
		};
	}

	renderCalculate () {
		const
			{dataSize} = this.props,
			{firstIndex, numOfItems} = this.state,
			max = Math.min(dataSize, firstIndex + numOfItems);

		this.positionItems({updateFrom: firstIndex, updateTo: max});
		this.positionContainer();
	}

	render () {
		const
			props = Object.assign({}, this.props),
			{positioningOption, onScroll} = this.props,
			{primary, cc} = this;

		delete props.cbScrollTo;
		delete props.component;
		delete props.data;
		delete props.dataSize;
		delete props.direction;
		delete props.hideScrollbars;
		delete props.itemSize;
		delete props.onScroll;
		delete props.onScrolling;
		delete props.onScrollStart;
		delete props.onScrollStop;
		delete props.overhang;
		delete props.pageScroll;
		delete props.positioningOption;
		delete props.spacing;

		if (primary) {
			this.renderCalculate();
		}

		if (positioningOption === 'byItem') {
			return (
				<div {...props} ref={this.initContainerRef}>
					{cc}
				</div>
			);
		} else {
			const {className, style, ...rest} = props;

			if (positioningOption === 'byBrowser') {
				this.composeOverflow(style);
			}

			return (
				<div ref={this.initWrapperRef} className={className} style={style} onScroll={onScroll}>
					<div {...rest} ref={this.initContainerRef}>
						{cc}
					</div>
				</div>
			);
		}
	}
}

/**
 * {@link moonstone/VirtualList.VirtualListBase} is a base component for
 * {@link moonstone/VirtualList.VirtualList} and
 * {@link moonstone/VirtualList.VirtualGridList} with Scrollable and SpotlightContainerDecorator applied.
 *
 * @class VirtualListBase
 * @memberof moonstone/VirtualList
 * @mixes moonstone/Scrollable
 * @mixes spotlight/SpotlightContainerDecorator
 * @ui
 * @private
 */
const VirtualListBase = SpotlightContainerDecorator({restrict: 'self-first'}, Scrollable(VirtualListCore));

export default VirtualListBase;
export {gridListItemSizeShape, VirtualListCore, VirtualListBase};
