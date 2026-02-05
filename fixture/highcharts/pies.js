// NIO_COMPONENT ui.platform

import { HIGHCHARTS_PIE_SERIES_SELECTOR, HIGHCHARTS_TRACK_CLASS } from './defaults';
import { extractSeriesGroups, getChartLocators, getRandomSeriesPoints } from './common';

export const getPies = async (globals, selector) => {
	const { page } = globals;

	const { locators, selectors } = await getChartLocators({ page }, selector);

	const { highchartsSeriesGroup } = locators;

	const { series, seriesCount } = await extractSeriesGroups(
		highchartsSeriesGroup,
		HIGHCHARTS_PIE_SERIES_SELECTOR,
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
