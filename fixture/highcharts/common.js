// NIO_COMPONENT ui.platform

import {
	HIGHCHARTS_POINTS_SELECTOR,
	HIGHCHARTS_GRAPH_SELECTOR,
	HIGHCHARTS_TRACK_CLASS,
	CONTAINER_SELECTOR,
	HIGHCHARTS_CONTAINER_SELECTOR,
	HIGHCHARTS_ROOT_SELECTOR,
	HIGHCHARTS_XAXIS_GRID_SELECTOR,
	HIGHCHARTS_YAXIS_GRID_SELECTOR,
	HIGHCHARTS_XAXIS_SELECTOR,
	HIGHCHARTS_YAXIS_SELECTOR,
	HIGHCHARTS_XAXIS_LABELS_SELECTOR,
	HIGHCHARTS_YAXIS_LABELS_SELECTOR,
	HIGHCHARTS_SERIES_GROUP_SELECTOR,
	HIGHCHARTS_TOOLTIP_SELECTOR,
	HIGHCHARTS_SERIES_START_SELECTOR,
} from './defaults';

/**
 *
 * @param page
 * @param selector
 * @param options
 * @returns {Promise<{locators: {highchartsSeriesGroup: *, highchartsXAxisLabels: *, highchartsXAxis: *, highchartsTooltip: *, highchartsContainer: *, highchartsXAxisGrid: *, highchartsYAxisLabels: *, highchartsYAxisGrid: *, highchartsRoot: *, highchartsYAxis: *}, selectors: {HIGHCHARTS_XAXIS_LABELS_SELECTOR: string, HIGHCHARTS_TOOLTIP_SELECTOR: string, HIGHCHARTS_XAXIS_SELECTOR: string, HIGHCHARTS_YAXIS_LABELS_SELECTOR: string, HIGHCHARTS_SERIES_GROUP_SELECTOR: string, HIGHCHARTS_CONTAINER_SELECTOR: string, HIGHCHARTS_ROOT_SELECTOR: string, HIGHCHARTS_YAXIS_GRID_SELECTOR: string, HIGHCHARTS_YAXIS_SELECTOR: string, HIGHCHARTS_XAXIS_GRID_SELECTOR: string}}>}
 */
export const getChartLocators = async ({ page }, selector, options = {}) => {
	const parentSelector =
		typeof selector === 'string'
			? page.locator(`${selector} ${CONTAINER_SELECTOR}`)
			: typeof selector === 'object' && selector.title
			? page.locator('.charts-container', {
					has: page.locator('text', {
						hasText: selector.title,
					}),
			  })
			: selector.locator(CONTAINER_SELECTOR);

	await parentSelector.isVisible();
	await parentSelector.screenshot();

	// highcharts container
	const highchartsContainer = parentSelector.locator(HIGHCHARTS_CONTAINER_SELECTOR);
	// svg root
	const highchartsRoot = highchartsContainer.locator(HIGHCHARTS_ROOT_SELECTOR);

	const highchartsXAxisGrid = highchartsContainer.locator(HIGHCHARTS_XAXIS_GRID_SELECTOR);
	const highchartsYAxisGrid = highchartsContainer.locator(HIGHCHARTS_YAXIS_GRID_SELECTOR);

	const highchartsXAxis = highchartsContainer.locator(HIGHCHARTS_XAXIS_SELECTOR);
	const highchartsYAxis = highchartsContainer.locator(HIGHCHARTS_YAXIS_SELECTOR);

	const highchartsXAxisLabels = highchartsContainer.locator(HIGHCHARTS_XAXIS_LABELS_SELECTOR);
	const highchartsYAxisLabels = highchartsContainer.locator(HIGHCHARTS_YAXIS_LABELS_SELECTOR);

	const highchartsSeriesGroup = highchartsContainer.locator(HIGHCHARTS_SERIES_GROUP_SELECTOR);
	const highchartsTooltip = highchartsContainer.locator(HIGHCHARTS_TOOLTIP_SELECTOR);

	return {
		locators: {
			highchartsContainer,
			highchartsRoot,
			highchartsSeriesGroup,
			highchartsTooltip,
			highchartsXAxisGrid,
			highchartsYAxisGrid,
			highchartsXAxisLabels,
			highchartsYAxisLabels,
			highchartsXAxis,
			highchartsYAxis,
		},
		selectors: {
			HIGHCHARTS_CONTAINER_SELECTOR,
			HIGHCHARTS_ROOT_SELECTOR,
			HIGHCHARTS_XAXIS_GRID_SELECTOR,
			HIGHCHARTS_YAXIS_GRID_SELECTOR,
			HIGHCHARTS_XAXIS_SELECTOR,
			HIGHCHARTS_YAXIS_SELECTOR,
			HIGHCHARTS_XAXIS_LABELS_SELECTOR,
			HIGHCHARTS_YAXIS_LABELS_SELECTOR,
			HIGHCHARTS_SERIES_GROUP_SELECTOR,
			HIGHCHARTS_TOOLTIP_SELECTOR,
		},
	};
};

/**
 * extract series group point and path information
 * notice: for some reason the 2nd  <path> inside line charts series groups does not get extracted correctly
 *
 *
 * @param highchartsSeriesGroup
 * @param typeSelector
 * @param pointSelector
 * @returns {Promise<{series: *[], seriesCount: number}>}
 */
export const extractSeriesGroups = async (
	highchartsSeriesGroup,
	typeSelector,
	pointSelector = HIGHCHARTS_TRACK_CLASS,
) => {
	const highchartsSeries = highchartsSeriesGroup.locator(typeSelector);

	const seriesGroupCount = await highchartsSeries.count();
	const series = [];

	// group the lines/points together
	for (let i = 0; i < seriesGroupCount; i++) {
		const seriesInstance = await highchartsSeries.nth(i);
		const classes = await seriesInstance.getAttribute('class');
		const classesList = classes.split(' ');

		let seriesId = null;
		let hasPoints = false;

		classesList.forEach(classEl => {
			if (classEl.startsWith(HIGHCHARTS_SERIES_START_SELECTOR)) {
				seriesId = Number(classEl.replace(HIGHCHARTS_SERIES_START_SELECTOR, ''));
			}

			if (classEl.indexOf(pointSelector) !== -1) {
				hasPoints = true;
			}
		});

		const classLocator = hasPoints ? HIGHCHARTS_POINTS_SELECTOR : HIGHCHARTS_GRAPH_SELECTOR;

		const pathLocators = await seriesInstance.locator(classLocator);
		const pathCount = await pathLocators.count();
		const paths = await pathLocators.all();

		if (seriesId !== null) {
			if (typeof series[seriesId] === 'undefined') {
				series[seriesId] = {
					id: seriesId,
					pathCount: 0,
					paths: [],
					pathLocators: [],
					pointCount: 0,
					points: [],
					pointLocators: [],
				};
			}

			if (hasPoints) {
				series[seriesId].pointCount = pathCount;
				series[seriesId].pointLocators = pathLocators;
				series[seriesId].points = paths;
			} else {
				series[seriesId].pathCount = pathCount;
				series[seriesId].pathLocators = pathLocators;
				series[seriesId].paths = paths;
			}
		}
	}

	const seriesCount = series.length;

	return { series, seriesCount };
};

/**
 * get random points (same for bars and lines) from the series of the charts
 *
 * @param series
 * @param seriesCount
 * @returns {Promise<{series, randomPointsCount: number, seriesCount, randomPoints: *[]}>}
 */
export const getRandomSeriesPoints = async (series, seriesCount) => {
	const randomPoints = [];

	// prepare random points
	for (let i = 0; i < seriesCount; i++) {
		const serie = series[i];
		const { pointCount, points } = serie;

		if (pointCount > 0) {
			const randomInt = Math.floor(Math.random() * pointCount);
			const randomPoint = points[randomInt];

			series[i].randomPoint = randomPoint;
			randomPoints.push(randomPoint);
		}
	}

	const randomPointsCount = randomPoints.length;

	return { series, seriesCount, randomPoints, randomPointsCount };
};
