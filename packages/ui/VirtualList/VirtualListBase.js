import classNames from 'classnames';
import {forward} from '@enact/core/handle';
import {platform} from '@enact/core/platform';
import PropTypes from 'prop-types';
import equals from 'ramda/src/equals';
import React, {Component} from 'react';

import Scrollable from '../Scrollable';
import ScrollableNative from '../Scrollable/ScrollableNative';

import css from './VirtualList.module.less';

const
	nop = () => {},
	JS = 'JS',
	Native = 'Native';

/**
 * The shape for the grid list item size
 * in a list for [VirtualGridList]{@link ui/VirtualList.VirtualGridList}.
 *
 * @typedef {Object} gridListItemSizeShape
 * @memberof ui/VirtualList
 * @property {Number}    minWidth    The minimum width of the grid list item.
 * @property {Number}    minHeight    The minimum height of the grid list item.
 * @public
 */
const gridListItemSizeShape = PropTypes.shape({
	minHeight: PropTypes.number.isRequired,
	minWidth: PropTypes.number.isRequired
});

/**
 * The base version of the virtual list component.
 *
 * @class VirtualListCore
 * @memberof ui/VirtualList
 * @ui
 * @private
 */
const VirtualListBaseFactory = (type) => {
	return class VirtualListCore extends Component {
		/* No displayName here. We set displayName to returned components of this factory function. */

		static propTypes = /** @lends ui/VirtualList.VirtualListBase.prototype */ {
			/**
			 * The rendering function called for each item in the list.
			 *
			 * > **Note**: The list does **not** always render a component whenever its render function is called
			 * due to performance optimization.
			 *
			 * Example:
			 * ```
			 * renderItem = ({index, ...rest}) => {
			 * 	delete rest.data;
			 *
			 * 	return (
			 * 		<MyComponent index={index} {...rest} />
			 * 	);
			 * }
			 * ```
			 *
			 * @type {Function}
			 * @param {Object}     event
			 * @param {Number}     event.data-index    It is required for `Spotlight` 5-way navigation. Pass to the root element in the component.
			 * @param {Number}     event.index    The index number of the component to render
			 * @param {Number}     event.key    It MUST be passed as a prop to the root element in the component for DOM recycling.
			 *
			 * @required
			 * @public
			 */
			itemRenderer: PropTypes.func.isRequired,

			/**
			 * The size of an item for the list; valid values are either a number for `VirtualList`
			 * or an object that has `minWidth` and `minHeight` for `VirtualGridList`.
			 *
			 * @type {Number|ui/VirtualList.gridListItemSizeShape}
			 * @required
			 * @private
			 */
			itemSize: PropTypes.oneOfType([
				PropTypes.number,
				gridListItemSizeShape
			]).isRequired,

			/**
			 * The render function for the items.
			 *
			 * @type {Function}
			 * @required
			 * @private
			 */
			itemsRenderer: PropTypes.func.isRequired,

			/**
			 * Callback method of scrollTo.
			 * Normally, [Scrollable]{@link ui/Scrollable.Scrollable} should set this value.
			 *
			 * @type {Function}
			 * @private
			 */
			cbScrollTo: PropTypes.func,

			/**
			 * Additional props included in the object passed to the `itemsRenderer` callback.
			 *
			 * @type {Object}
			 * @public
			 */
			childProps: PropTypes.object,

			/**
			 * Client size of the list; valid values are an object that has `clientWidth` and `clientHeight`.
			 *
			 * @type {Object}
			 * @property {Number}    clientHeight    The client height of the list.
			 * @property {Number}    clientWidth    The client width of the list.
			 * @public
			 */
			clientSize: PropTypes.shape({
				clientHeight: PropTypes.number.isRequired,
				clientWidth: PropTypes.number.isRequired
			}),

			/**
			 * Activates the component for voice control.
			 *
			 * @type {Boolean}
			 * @public
			 */
			'data-webos-voice-focused': PropTypes.bool,

			/**
			 * The voice control group label.
			 *
			 * @type {String}
			 * @public
			 */
			'data-webos-voice-group-label': PropTypes.string,

			/**
			 * The number of items of data the list contains.
			 *
			 * @type {Number}
			 * @default 0
			 * @public
			 */
			dataSize: PropTypes.number,

			/**
			 * The layout direction of the list.
			 *
			 * Valid values are:
			 * * `'horizontal'`, and
			 * * `'vertical'`.
			 *
			 * @type {String}
			 * @default 'vertical'
			 * @public
			 */
			direction: PropTypes.oneOf(['horizontal', 'vertical']),

			/**
			 * Called to get the props for list items.
			 *
			 * @type {Function}
			 * @private
			 */
			getComponentProps: PropTypes.func,

			/**
			 * Called when the range of items has updated.
			 *
			 * Event payload includes the `firstIndex` and `lastIndex` of the list.
			 *
			 * @type {Function}
			 * @private
			 */
			onUpdateItems: PropTypes.func,

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
			 * When `true`, the list will scroll by page.  Otherwise the list will scroll by item.
			 *
			 * @type {Boolean}
			 * @default false
			 * @private
			 */
			pageScroll: PropTypes.bool,

			/**
			 * `true` if RTL, `false` if LTR.
			 *
			 * @type {Boolean}
			 * @private
			 */
			rtl: PropTypes.bool,

			/**
			 * The spacing between items.
			 *
			 * @type {Number}
			 * @default 0
			 * @public
			 */
			spacing: PropTypes.number,

			/**
			 * Type of the list. If you want to use variable item height, you need to define it to `'NewVirtualList'`.
			 *
			 * Valid values are:
			 * * `'VirtualList'`, and
			 * * `'NewVirtualList'`.
			 *
			 * @type {String}
			 * @default 'VirtualList'
			 * @private
			 */
			type: PropTypes.oneOf(['VirtualList', 'NewVirtualList']),

			/**
			 * Called to execute additional logic in a themed component when updating states and bounds.
			 *
			 * @type {Function}
			 * @private
			 */
			updateStatesAndBounds: PropTypes.func,

			/**
			 * The array for variable item size.
			 *
			 * @type {String}
			 * @default 'VirtualList'
			 * @private
			 */
			variableGridSizes: PropTypes.array
		}

		static defaultProps = {
			cbScrollTo: nop,
			dataSize: 0,
			direction: 'vertical',
			overhang: 3,
			pageScroll: false,
			spacing: 0,
			type: 'VirtualList'
		}

		constructor (props) {
			let nextState = null;

			super(props);

			this.containerRef = React.createRef();
			this.contentRef = React.createRef();
			this.itemContainerRef = React.createRef();

			if (props.clientSize) {
				this.calculateMetrics(props);
				nextState = this.getStatesAndUpdateBounds(props);
			}

			this.state = {
				firstIndex: 0,
				numOfItems: 0,
				prevChildProps: null,
				prevFirstIndex: 0,
				updateFrom: 0,
				updateTo: 0,
				...nextState
			};
		}

		static getDerivedStateFromProps (props, state) {
			const
				shouldInvalidate = (
					state.prevFirstIndex === state.firstIndex ||
					state.prevChildProps !== props.childProps
				),
				diff = state.firstIndex - state.prevFirstIndex,
				updateTo = (-state.numOfItems >= diff || diff > 0 || shouldInvalidate) ? state.firstIndex + state.numOfItems : state.prevFirstIndex,
				updateFrom = (0 >= diff || diff >= state.numOfItems || shouldInvalidate) ? state.firstIndex : state.prevFirstIndex + state.numOfItems,
				nextUpdateFromAndTo = (state.updateFrom !== updateFrom || state.updateTo !== updateTo) ? {updateFrom, updateTo} : null;

			return {
				...nextUpdateFromAndTo,
				prevChildProps: props.childProps,
				prevFirstIndex: state.firstIndex
			};
		}

		// Calculate metrics for VirtualList after the 1st render to know client W/H.
		componentDidMount () {
			if (!this.props.clientSize) {
				this.calculateMetrics(this.props);
				// eslint-disable-next-line react/no-did-mount-set-state
				this.setState(this.getStatesAndUpdateBounds(this.props));
			} else {
				this.emitUpdateItems();
			}

			if (this.props.type === 'NewVirtualList') {
				this.adjustVariableGridPosition();
			} else {
				this.setContainerSize();
			}
		}

		componentDidUpdate (prevProps, prevState) {
			const {firstIndex, numOfItems} = this.state;

			// TODO: remove `this.hasDataSizeChanged` and fix ui/Scrollable*
			this.hasDataSizeChanged = (prevProps.dataSize !== this.props.dataSize);

			if (prevState.firstIndex !== firstIndex || prevState.numOfItems !== numOfItems) {
				this.emitUpdateItems();
			}

			if (this.props.type === 'NewVirtualList') {
				if (this.variableGridPositions.length > this.props.variableGridSizes.length) {
					this.variableGridPositions = [...this.variableGridPositions.slice(0, this.props.variableGridSizes.length)];
				}
				this.adjustVariableGridPosition();
			}

			if (
				prevProps.direction !== this.props.direction ||
				prevProps.overhang !== this.props.overhang ||
				prevProps.spacing !== this.props.spacing ||
				!equals(prevProps.itemSize, this.props.itemSize)
			) {
				this.calculateMetrics(this.props);
				// eslint-disable-next-line react/no-did-update-set-state
				this.setState(this.getStatesAndUpdateBounds(this.props));
				this.setContainerSize();
			} else if (this.hasDataSizeChanged) {
				const newState = this.getStatesAndUpdateBounds(this.props, this.state.firstIndex);
				// eslint-disable-next-line react/no-did-update-set-state
				this.setState(newState);
				this.setContainerSize();
			} else if (prevProps.rtl !== this.props.rtl) {
				const {x, y} = this.getXY(this.scrollPosition, 0);

				if (type === Native) {
					this.scrollToPosition(x, y, this.props.rtl);
				} else {
					this.setScrollPosition(x, y, this.props.rtl);
				}
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
		hasDataSizeChanged = false
		cc = []
		variableGridPositions = []
		scrollPosition = 0

		isVertical = () => this.isPrimaryDirectionVertical

		isHorizontal = () => !this.isPrimaryDirectionVertical

		getScrollBounds = () => this.scrollBounds

		getMoreInfo = () => this.moreInfo

		getGridPosition (index) {
			if (this.props.type === 'NewVirtualList') {
				const
					{dimensionToExtent, primary, secondary, variableGridPositions} = this,
					extent = Math.floor(index / dimensionToExtent),
					firstIndexInExtent = extent * dimensionToExtent,
					primaryPosition = variableGridPositions[firstIndexInExtent] ? variableGridPositions[firstIndexInExtent].position : extent * primary.gridSize,
					secondaryPosition = (index % dimensionToExtent) * secondary.gridSize;

				return {primaryPosition, secondaryPosition};
			} else {
				const
					{dimensionToExtent, primary, secondary} = this,
					primaryPosition = Math.floor(index / dimensionToExtent) * primary.gridSize,
					secondaryPosition = (index % dimensionToExtent) * secondary.gridSize;

				return {primaryPosition, secondaryPosition};
			}
		}

		// For NewVirtualList
		getVariableGridBottomPosition = (index) => {
			const
				variableGridPosition = this.variableGridPositions[index],
				variableGridSize = this.props.variableGridSizes[index];

			if (variableGridPosition && (variableGridSize || variableGridSize === 0)) {
				return variableGridPosition.position + variableGridSize;
			} else {
				return index * this.primary.gridSize - this.props.spacing;
			}
		}

		getItemPosition = (index, stickTo = 'start') => {
			const
				{primary} = this,
				position = this.getGridPosition(index),
				offset = (stickTo === 'start') ? 0 : primary.clientSize - primary.itemSize;

			position.primaryPosition -= offset;

			return this.gridPositionToItemPosition(position);
		}

		gridPositionToItemPosition = ({primaryPosition, secondaryPosition}) =>
			(this.isPrimaryDirectionVertical ? {left: secondaryPosition, top: primaryPosition} : {left: primaryPosition, top: secondaryPosition})

		getXY = (primaryPosition, secondaryPosition) => (this.isPrimaryDirectionVertical ? {x: secondaryPosition, y: primaryPosition} : {x: primaryPosition, y: secondaryPosition})

		getClientSize = (node) => ({
			clientWidth: node.clientWidth,
			clientHeight: node.clientHeight
		})

		emitUpdateItems () {
			const {dataSize} = this.props;
			const {firstIndex, numOfItems} = this.state;

			forward('onUpdateItems', {
				firstIndex: firstIndex,
				lastIndex: Math.min(firstIndex + numOfItems, dataSize)
			}, this.props);
		}

		calculateMetrics (props) {
			const
				{clientSize, direction, itemSize, overhang, spacing} = props,
				node = this.containerRef.current;

			if (!clientSize && !node) {
				return;
			}

			const
				{clientWidth, clientHeight} = (clientSize || this.getClientSize(node)),
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
				secondary.itemSize = Math.floor((secondary.clientSize - (spacing * (dimensionToExtent - 1))) / dimensionToExtent);
				// the actual item height is related to the item width
				primary.itemSize = Math.floor(primary.minItemSize * (secondary.itemSize / secondary.minItemSize));
			}

			primary.gridSize = primary.itemSize + spacing;
			secondary.gridSize = secondary.itemSize + spacing;
			thresholdBase = primary.gridSize * Math.ceil(overhang / 2);

			this.threshold = {min: -Infinity, max: thresholdBase, base: thresholdBase};
			this.dimensionToExtent = dimensionToExtent;

			this.primary = primary;
			this.secondary = secondary;

			// reset
			this.scrollPosition = 0;
			if (type === JS && this.contentRef.current) {
				this.contentRef.current.style.transform = null;
			}
		}

		getStatesAndUpdateBounds = (props, firstIndex = 0) => {
			const
				{dataSize, overhang, updateStatesAndBounds} = props,
				{dimensionToExtent, primary, moreInfo, scrollPosition} = this,
				numOfItems = Math.min(dataSize, dimensionToExtent * (Math.ceil(primary.clientSize / primary.gridSize) + overhang)),
				wasFirstIndexMax = ((this.maxFirstIndex < moreInfo.firstVisibleIndex - dimensionToExtent) && (firstIndex === this.maxFirstIndex)),
				dataSizeDiff = dataSize - this.curDataSize;
			let newFirstIndex = firstIndex;

			this.maxFirstIndex = Math.ceil((dataSize - numOfItems) / dimensionToExtent) * dimensionToExtent;
			this.curDataSize = dataSize;

			// reset children
			this.cc = [];
			this.variableGridPositions = [];
			this.calculateScrollBounds(props);
			this.updateMoreInfo(dataSize, scrollPosition);

			if (!(updateStatesAndBounds && updateStatesAndBounds({
				cbScrollTo: props.cbScrollTo,
				numOfItems,
				dataSize,
				moreInfo
			}))) {
				newFirstIndex = this.calculateFirstIndex(props, wasFirstIndexMax, dataSizeDiff, firstIndex);
			}

			return {
				firstIndex: newFirstIndex,
				numOfItems: numOfItems
			};
		}

		calculateFirstIndex (props, wasFirstIndexMax, dataSizeDiff, firstIndex) {
			const
				{overhang} = props,
				{dimensionToExtent, isPrimaryDirectionVertical, maxFirstIndex, primary, scrollBounds, scrollPosition, threshold} = this,
				{gridSize} = primary;
			let newFirstIndex = firstIndex;

			if (wasFirstIndexMax && dataSizeDiff > 0) { // If dataSize increased from bottom, we need adjust firstIndex
				// If this is a gridlist and dataSizeDiff is smaller than 1 line, we are adjusting firstIndex without threshold change.
				if (dimensionToExtent > 1 && dataSizeDiff < dimensionToExtent) {
					newFirstIndex = maxFirstIndex;
				} else { // For other bottom adding case, we need to update firstIndex and threshold.
					const
						maxPos = isPrimaryDirectionVertical ? scrollBounds.maxTop : scrollBounds.maxLeft,
						maxOfMin = maxPos - threshold.base,
						numOfUpperLine = Math.floor(overhang / 2),
						firstIndexFromPosition = Math.floor(scrollPosition / gridSize),
						expectedFirstIndex = Math.max(0, firstIndexFromPosition - numOfUpperLine);

					// To navigate with 5way, we need to adjust firstIndex to the next line
					// since at the bottom we have num of overhang lines for upper side but none for bottom side
					// So we add numOfUpperLine at the top and rest lines at the bottom
					newFirstIndex = Math.min(maxFirstIndex, expectedFirstIndex * dimensionToExtent);

					// We need to update threshold also since we moved the firstIndex
					threshold.max = Math.min(maxPos, threshold.max + gridSize);
					threshold.min = Math.min(maxOfMin, threshold.max - gridSize);
				}
			} else { // Other cases, we can keep the min value between firstIndex and maxFirstIndex. No need to change threshold
				newFirstIndex = Math.min(firstIndex, maxFirstIndex);
			}

			return newFirstIndex;
		}

		calculateScrollBounds (props) {
			const
				{clientSize} = props,
				node = this.containerRef.current;

			if (!clientSize && !node) {
				return;
			}

			const
				{scrollBounds, isPrimaryDirectionVertical} = this,
				{clientWidth, clientHeight} = clientSize || this.getClientSize(node);
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
				this.props.cbScrollTo({position: (isPrimaryDirectionVertical) ? {y: maxPos} : {x: maxPos}, animate: false});
			}
		}

		setContainerSize = () => {
			if (this.contentRef.current) {
				this.contentRef.current.style.width = this.scrollBounds.scrollWidth + (this.isPrimaryDirectionVertical ? -1 : 0) + 'px';
				this.contentRef.current.style.height = this.scrollBounds.scrollHeight + (this.isPrimaryDirectionVertical ? 0 : -1) + 'px';
			}
		}

		updateMoreInfo (dataSize, primaryPosition) {
			const
				{dimensionToExtent, moreInfo} = this,
				{itemSize, gridSize, clientSize} = this.primary;

			if (dataSize <= 0) {
				moreInfo.firstVisibleIndex = null;
				moreInfo.lastVisibleIndex = null;
			} else {
				moreInfo.firstVisibleIndex = (Math.floor((primaryPosition - itemSize) / gridSize) + 1) * dimensionToExtent;
				moreInfo.lastVisibleIndex = Math.min(dataSize - 1, Math.ceil((primaryPosition + clientSize) / gridSize) * dimensionToExtent - 1);
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

		// Native only
		scrollToPosition (x, y, rtl = this.props.rtl) {
			if (this.containerRef.current) {
				if (rtl) {
					x = (platform.ios || platform.safari) ? -x : this.scrollBounds.maxLeft - x;
				}
				this.containerRef.current.scrollTo(x, y);
			}
		}

		// JS only
		setScrollPosition (x, y, rtl = this.props.rtl) {
			if (this.contentRef.current) {
				this.contentRef.current.style.transform = `translate3d(${rtl ? x : -x}px, -${y}px, 0)`;
				this.didScroll(x, y);
			}
		}

		didScroll (x, y) {
			const
				{dataSize, spacing, variableGridSizes} = this.props,
				{firstIndex} = this.state,
				{isPrimaryDirectionVertical, threshold, dimensionToExtent, maxFirstIndex, scrollBounds, variableGridPositions} = this,
				{clientSize, gridSize} = this.primary,
				maxPos = isPrimaryDirectionVertical ? scrollBounds.maxTop : scrollBounds.maxLeft;
			let newFirstIndex = firstIndex, index, pos, size, variableGridPosition;

			if (isPrimaryDirectionVertical) {
				pos = y;
			} else {
				pos = x;
			}

			if (pos > threshold.max || pos < threshold.min) {
				let newThresholdMin = -Infinity, newThresholdMax = Infinity;

				if (this.props.type === 'NewVirtualList') {
					const overhangBefore = Math.floor(this.props.overhang / 2);
					let firstRenderedIndex = -1;

					// find an item which is known as placed the first rendered item's position
					for (index = 0; index < dataSize; index += dimensionToExtent) {
						variableGridPosition = variableGridPositions[index];
						size = variableGridSizes[index];
						if (variableGridPosition && size && variableGridPosition.position + size >= pos && variableGridPosition.position <= pos + clientSize) {
							firstRenderedIndex = index;
							break;
						}
					}

					// found an item which is visible within a current viewport
					if (index < dataSize) {
						if (variableGridPosition.position <= pos) {
							newFirstIndex = firstRenderedIndex - overhangBefore * dimensionToExtent;
							newThresholdMin = variableGridPosition.position;
							newThresholdMax = newThresholdMin + size + spacing;
						} else {
							const diffToFirstIndex = Math.ceil((variableGridPosition.position - pos) / gridSize);
							newFirstIndex = firstRenderedIndex - (diffToFirstIndex + overhangBefore) * dimensionToExtent;
							newThresholdMin = variableGridPosition.position - diffToFirstIndex * gridSize;
							newThresholdMax = newThresholdMin + gridSize;
						}
					} else { // calculate the first index based on assuming that all items have minimal size
						const firstExtent = Math.max(
							0,
							Math.min(
								Math.floor(maxFirstIndex / dimensionToExtent),
								Math.floor((pos - gridSize * overhangBefore) / gridSize)
							)
						);

						newFirstIndex = firstExtent * dimensionToExtent;
						newThresholdMin = (firstExtent + overhangBefore) * gridSize;
						newThresholdMax = newThresholdMin + gridSize;
					}

					newFirstIndex = Math.max(0, Math.min(maxFirstIndex, newFirstIndex));
				} else {
					const
						overhangBefore = Math.floor(this.props.overhang / 2),
						firstExtent = Math.max(
							0,
							Math.min(
								Math.floor(maxFirstIndex / dimensionToExtent),
								Math.floor((pos - gridSize * overhangBefore) / gridSize)
							)
						);

					newFirstIndex = firstExtent * dimensionToExtent;
					newThresholdMin = (firstExtent + overhangBefore) * gridSize;
					newThresholdMax = newThresholdMin + gridSize;
				}

				threshold.min = newFirstIndex === 0 ? -Infinity : newThresholdMin;
				threshold.max = newFirstIndex === maxFirstIndex ? Infinity : newThresholdMax;
			}

			this.syncThreshold(maxPos);
			this.scrollPosition = pos;
			this.updateMoreInfo(dataSize, pos);

			if (firstIndex !== newFirstIndex) {
				this.setState({firstIndex: newFirstIndex});
			}
		}

		// For NewVirtualList
		adjustVariableGridPosition () {
			const
				{dataSize, direction, overhang, spacing, variableGridSizes} = this.props,
				{firstIndex, numOfItems} = this.state,
				{isPrimaryDirectionVertical, itemContainerRef, maxFirstIndex, variableGridPositions} = this,
				lastIndex = firstIndex + numOfItems - 1,
				numOfUpperLine = Math.floor(overhang / 2),
				scrollBoundsDimension = isPrimaryDirectionVertical ? 'scrollHeight' : 'scrollWidth';

			if (itemContainerRef.current) {
				let index;

				// Cache variable item positions
				// and adjust variable item DOM element positions
				for (index = firstIndex; index <= lastIndex; index++) {
					const childNode = itemContainerRef.current.children[index % numOfItems];

					if (!variableGridPositions[index] && variableGridSizes[index]) {
						const position = index === 0 ? 0 : this.getVariableGridBottomPosition(index - 1) + spacing;

						variableGridPositions[index] = {position};
					}

					if (childNode && variableGridPositions[index]) {
						if (direction === 'vertical') {
							childNode.style.transform = `translate3d(0, ${variableGridPositions[index].position}px, 0)`;
						} else {
							childNode.style.transform = `translate3d(${variableGridPositions[index].position}px, 0, 0)`;
						}
					}
				}

				// Update threshold
				this.threshold.min = firstIndex === 0 ? -Infinity : this.getVariableGridBottomPosition(firstIndex + numOfUpperLine * 1);
				this.threshold.max = lastIndex === maxFirstIndex ? Infinity : this.getVariableGridBottomPosition(firstIndex + (numOfUpperLine + 1));

				// Update scroll bounds
				if (variableGridPositions.length === dataSize) { // all item sizes are known
					this.scrollBounds[scrollBoundsDimension] =
						variableGridSizes.reduce((acc, cur) => acc + cur, 0) + (dataSize - 1) * spacing;
				} else {
					for (index = firstIndex + numOfItems - 1; index < dataSize; index++) {
						const nextInfo = variableGridPositions[index + 1];
						if (!nextInfo) {
							const endPosition = this.getVariableGridBottomPosition(index);
							if (endPosition > this.scrollBounds[scrollBoundsDimension]) {
								this.scrollBounds[scrollBoundsDimension] = endPosition;
							}

							break;
						}
					}
				}
				this.scrollBounds.maxTop = Math.max(0, this.scrollBounds.scrollHeight - this.scrollBounds.clientHeight);

				this.setContainerSize();
			}
		}

		getItemNode = (index) => {
			const ref = this.itemContainerRef.current;

			return ref ? ref.children[index % this.state.numOfItems] : null;
		}

		composeStyle (width, height, primaryPosition, secondaryPosition) {
			const
				{x, y} = this.getXY(primaryPosition, secondaryPosition),
				style = {
					position: 'absolute',
					/* FIXME: RTL / this calculation only works for Chrome */
					transform: `translate3d(${this.props.rtl ? -x : x}px, ${y}px, 0)`
				};

			if (this.isItemSized) {
				style.width = width;
				style.height = height;
			}

			return style;
		}

		applyStyleToNewNode = (index, ...rest) => {
			const
				{itemRenderer, getComponentProps} = this.props,
				key = index % this.state.numOfItems,
				itemElement = itemRenderer({
					...this.props.childProps,
					key,
					index
				}),
				componentProps = getComponentProps && getComponentProps(index) || {};

			this.cc[key] = React.cloneElement(itemElement, {
				...componentProps,
				className: classNames(css.listItem, itemElement.props.className),
				style: {...itemElement.props.style, ...(this.composeStyle(...rest))}
			});
		}

		applyStyleToHideNode = (index) => {
			const key = index % this.state.numOfItems;
			this.cc[key] = <div key={key} style={{display: 'none'}} />;
		}

		positionItems () {
			const
				{dataSize, variableGridSizes} = this.props,
				{firstIndex, numOfItems} = this.state,
				{cc, isPrimaryDirectionVertical, dimensionToExtent, primary, secondary, variableGridPositions} = this;
			let
				hideTo = 0,
				updateFrom = cc.length ? this.state.updateFrom : firstIndex,
				updateTo = cc.length ? this.state.updateTo : firstIndex + numOfItems;

			if (updateFrom >= updateTo) {
				return;
			} else if (updateTo > dataSize) {
				hideTo = updateTo;
				updateTo = dataSize;
			}

			let
				width, height,
				{primaryPosition, secondaryPosition} = this.getGridPosition(updateFrom);

			width = (isPrimaryDirectionVertical ? secondary.itemSize : primary.itemSize) + 'px';
			height = (isPrimaryDirectionVertical ? primary.itemSize : secondary.itemSize) + 'px';

			// positioning items
			for (let i = updateFrom, j = updateFrom % dimensionToExtent; i < updateTo; i++) {
				this.applyStyleToNewNode(i, width, height, primaryPosition, secondaryPosition);

				if (++j === dimensionToExtent) {
					secondaryPosition = 0;

					if (this.props.type === 'NewVirtualList') {
						if (variableGridPositions[i + 1] || variableGridPositions[i + 1] === 0) {
							primaryPosition = variableGridPositions[i + 1].position;
						} else if (variableGridSizes[i]) {
							primaryPosition += variableGridSizes[i] + this.props.spacing;
						} else {
							primaryPosition += primary.gridSize;
						}
					} else {
						primaryPosition += primary.gridSize;
					}

					j = 0;
				} else {
					secondaryPosition += secondary.gridSize;
				}
			}

			for (let i = updateTo; i < hideTo; i++) {
				this.applyStyleToHideNode(i);
			}
		}

		getScrollHeight = () => (this.isPrimaryDirectionVertical ? this.getVirtualScrollDimension() : this.scrollBounds.clientHeight)

		getScrollWidth = () => (this.isPrimaryDirectionVertical ? this.scrollBounds.clientWidth : this.getVirtualScrollDimension())

		getVirtualScrollDimension = () => {
			const
				{dimensionToExtent, primary, curDataSize} = this,
				{spacing} = this.props;

			return (Math.ceil(curDataSize / dimensionToExtent) * primary.gridSize) - spacing;
		}

		syncClientSize = () => {
			const
				{props} = this,
				node = this.containerRef.current;

			if (!props.clientSize && !node) {
				return false;
			}

			const
				{clientWidth, clientHeight} = props.clientSize || this.getClientSize(node),
				{scrollBounds} = this;

			if (clientWidth !== scrollBounds.clientWidth || clientHeight !== scrollBounds.clientHeight) {
				this.calculateMetrics(props);
				this.setState(this.getStatesAndUpdateBounds(props));
				this.setContainerSize();
				return true;
			}

			return false;
		}

		// render

		mergeClasses = (className) => {
			let containerClass = null;

			if (type === Native) {
				containerClass = (this.isPrimaryDirectionVertical) ? css.vertical : css.horizontal;
			}

			return classNames(css.virtualList, containerClass, className);
		}

		render () {
			const
				{className, 'data-webos-voice-focused': voiceFocused, 'data-webos-voice-group-label': voiceGroupLabel, itemsRenderer, style, ...rest} = this.props,
				{cc, itemContainerRef, primary} = this,
				containerClasses = this.mergeClasses(className);

			delete rest.cbScrollTo;
			delete rest.childProps;
			delete rest.clientSize;
			delete rest.dataSize;
			delete rest.direction;
			delete rest.getComponentProps;
			delete rest.isVerticalScrollbarVisible;
			delete rest.itemRenderer;
			delete rest.itemSize;
			delete rest.onUpdate;
			delete rest.onUpdateItems;
			delete rest.overhang;
			delete rest.pageScroll;
			delete rest.rtl;
			delete rest.spacing;
			delete rest.updateStatesAndBounds;
			delete rest.variableGridSizes;

			if (primary) {
				this.positionItems();
			}

			return (
				<div className={containerClasses} data-webos-voice-focused={voiceFocused} data-webos-voice-group-label={voiceGroupLabel} ref={this.containerRef} style={style}>
					<div {...rest} ref={this.contentRef}>
						{itemsRenderer({cc, itemContainerRef, primary})}
					</div>
				</div>
			);
		}
	};
};

/**
 * A basic base component for
 * [VirtualList]{@link ui/VirtualList.VirtualList} and [VirtualGridList]{@link ui/VirtualList.VirtualGridList}.
 *
 * @class VirtualListBase
 * @memberof ui/VirtualList
 * @ui
 * @public
 */
const VirtualListBase = VirtualListBaseFactory(JS);
VirtualListBase.displayName = 'ui:VirtualListBase';

/**
 * A basic base component for
 * [VirtualListNative]{@link ui/VirtualList.VirtualListNative} and [VirtualGridListNative]{@link ui/VirtualList.VirtualGridListNative}.
 *
 * @class VirtualListBaseNative
 * @memberof ui/VirtualList
 * @ui
 * @private
 */
const VirtualListBaseNative = VirtualListBaseFactory(Native);
VirtualListBaseNative.displayName = 'ui:VirtualListBaseNative';

/**
 * A callback function that receives a reference to the `scrollTo` feature.
 *
 * Once received, the `scrollTo` method can be called as an imperative interface.
 *
 * The `scrollTo` function accepts the following paramaters:
 * - {position: {x, y}} - Pixel value for x and/or y position
 * - {align} - Where the scroll area should be aligned. Values are:
 *   `'left'`, `'right'`, `'top'`, `'bottom'`,
 *   `'topleft'`, `'topright'`, `'bottomleft'`, and `'bottomright'`.
 * - {index} - Index of specific item. (`0` or positive integer)
 *   This option is available for only `VirtualList` kind.
 * - {node} - Node to scroll into view
 * - {animate} - When `true`, scroll occurs with animation. When `false`, no
 *   animation occurs.
 * - {focus} - When `true`, attempts to focus item after scroll. Only valid when scrolling
 *   by `index` or `node`.
 * > Note: Only specify one of: `position`, `align`, `index` or `node`
 *
 * Example:
 * ```
 *	// If you set cbScrollTo prop like below;
 *	cbScrollTo: (fn) => {this.scrollTo = fn;}
 *	// You can simply call like below;
 *	this.scrollTo({align: 'top'}); // scroll to the top
 * ```
 *
 * @name cbScrollTo
 * @memberof ui/VirtualList.VirtualListBase.prototype
 * @type {Function}
 * @public
 */

/**
 * Specifies how to show horizontal scrollbar.
 *
 * Valid values are:
 * * `'auto'`,
 * * `'visible'`, and
 * * `'hidden'`.
 *
 * @name horizontalScrollbar
 * @memberof ui/VirtualList.VirtualListBase.prototype
 * @type {String}
 * @default 'auto'
 * @public
 */

/**
 * Prevents scroll by wheeling on the list.
 *
 * @name noScrollByWheel
 * @memberof ui/VirtualList.VirtualListBase.prototype
 * @type {Boolean}
 * @default false
 * @public
 */

/**
 * Called when scrolling.
 *
 * Passes `scrollLeft`, `scrollTop`, and `moreInfo`.
 * It is not recommended to set this prop since it can cause performance degradation.
 * Use `onScrollStart` or `onScrollStop` instead.
 *
 * @name onScroll
 * @memberof ui/VirtualList.VirtualListBase.prototype
 * @type {Function}
 * @param {Object} event
 * @param {Number} event.scrollLeft Scroll left value.
 * @param {Number} event.scrollTop Scroll top value.
 * @param {Object} event.moreInfo The object including `firstVisibleIndex` and `lastVisibleIndex` properties.
 * @public
 */

/**
 * Called when scroll starts.
 *
 * Passes `scrollLeft`, `scrollTop`, and `moreInfo`.
 * You can get firstVisibleIndex and lastVisibleIndex from VirtualList with `moreInfo`.
 *
 * Example:
 * ```
 * onScrollStart = ({scrollLeft, scrollTop, moreInfo}) => {
 *     const {firstVisibleIndex, lastVisibleIndex} = moreInfo;
 *     // do something with firstVisibleIndex and lastVisibleIndex
 * }
 *
 * render = () => (
 *     <VirtualList
 *         ...
 *         onScrollStart={this.onScrollStart}
 *         ...
 *     />
 * )
 * ```
 *
 * @name onScrollStart
 * @memberof ui/VirtualList.VirtualListBase.prototype
 * @type {Function}
 * @param {Object} event
 * @param {Number} event.scrollLeft Scroll left value.
 * @param {Number} event.scrollTop Scroll top value.
 * @param {Object} event.moreInfo The object including `firstVisibleIndex` and `lastVisibleIndex` properties.
 * @public
 */

/**
 * Called when scroll stops.
 *
 * Passes `scrollLeft`, `scrollTop`, and `moreInfo`.
 * You can get firstVisibleIndex and lastVisibleIndex from VirtualList with `moreInfo`.
 *
 * Example:
 * ```
 * onScrollStop = ({scrollLeft, scrollTop, moreInfo}) => {
 *     const {firstVisibleIndex, lastVisibleIndex} = moreInfo;
 *     // do something with firstVisibleIndex and lastVisibleIndex
 * }
 *
 * render = () => (
 *     <VirtualList
 *         ...
 *         onScrollStop={this.onScrollStop}
 *         ...
 *     />
 * )
 * ```
 *
 * @name onScrollStop
 * @memberof ui/VirtualList.VirtualListBase.prototype
 * @type {Function}
 * @param {Object} event
 * @param {Number} event.scrollLeft Scroll left value.
 * @param {Number} event.scrollTop Scroll top value.
 * @param {Object} event.moreInfo The object including `firstVisibleIndex` and `lastVisibleIndex` properties.
 * @public
 */

/**
 * Specifies how to show vertical scrollbar.
 *
 * Valid values are:
 * * `'auto'`,
 * * `'visible'`, and
 * * `'hidden'`.
 *
 * @name verticalScrollbar
 * @memberof ui/VirtualList.VirtualListBase.prototype
 * @type {String}
 * @default 'auto'
 * @public
 */

const ScrollableVirtualList = (props) => (
	<Scrollable
		{...props}
		childRenderer={({initChildRef, ...rest}) => ( // eslint-disable-line react/jsx-no-bind
			<VirtualListBase
				{...rest}
				itemsRenderer={({cc, itemContainerRef}) => ( // eslint-disable-line react/jsx-no-bind
					cc.length ? <div ref={itemContainerRef} role="list">{cc}</div> : null
				)}
				ref={initChildRef}
			/>
		)}
	/>
);

ScrollableVirtualList.propTypes = {
	direction: PropTypes.oneOf(['horizontal', 'vertical'])
};

ScrollableVirtualList.defaultProps = {
	direction: 'vertical'
};

const ScrollableVirtualListNative = (props) => (
	<ScrollableNative
		{...props}
		childRenderer={({initChildRef, ...rest}) => ( // eslint-disable-line react/jsx-no-bind
			<VirtualListBaseNative
				{...rest}
				itemsRenderer={({cc, itemContainerRef}) => ( // eslint-disable-line react/jsx-no-bind
					cc.length ? <div ref={itemContainerRef} role="list">{cc}</div> : null
				)}
				ref={initChildRef}
			/>
		)}
	/>
);

ScrollableVirtualListNative.propTypes = /** @lends ui/VirtualList.VirtualListBaseNative.prototype */ {
	direction: PropTypes.oneOf(['horizontal', 'vertical'])
};

ScrollableVirtualListNative.defaultProps = {
	direction: 'vertical'
};

export default VirtualListBase;
export {
	gridListItemSizeShape,
	ScrollableVirtualList,
	ScrollableVirtualListNative,
	VirtualListBase,
	VirtualListBaseNative
};
