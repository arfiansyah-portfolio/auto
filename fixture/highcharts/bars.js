// NIO_COMPONENT ui.platform

import { HIGHCHARTS_BAR_SERIES_SELECTOR, HIGHCHARTS_COLUMN_SERIES_SELECTOR, HIGHCHARTS_TRACK_CLASS } from './defaults';
import { extractSeriesGroups, getChartLocators, getRandomSeriesPoints } from './common';

export const getBars = async (globals, selector) => {
	const { page } = globals;

	const { locators, selectors } = await getChartLocators({ page }, selector);

	const { highchartsSeriesGroup } = locators;

	const barSelectors = HIGHCHARTS_BAR_SERIES_SELECTOR + ', ' + HIGHCHARTS_COLUMN_SERIES_SELECTOR;

	const { series, seriesCount } = await extractSeriesGroups(
		highchartsSeriesGroup,
		barSelectors,
		HIGHCHARTS_TRACK_CLASS,
	);

	const {
		series: finalSeries,
		seriesCount: finalSeriesCount,
		randomPoints,
		randomPointsCount,
	} = await getRandomSeriesPoints(series, seriesCount);

	return { series: finalSeries, seriesCount: finalSeriesCount, randomPoints, randomPointsCount, locators, selectors };
};

export const getBarAt = async (globals, selector, num) => {
	const bars = await getBars(globals, selector);

	const { series, seriesCount } = bars;

	return series[num];
};
