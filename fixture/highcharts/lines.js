// NIO_COMPONENT ui.platform
import { HIGHCHARTS_SPLINE_SERIES_SELECTOR, HIGHCHARTS_TRACK_CLASS } from './defaults';
import { getChartLocators, getRandomSeriesPoints, extractSeriesGroups } from './common';

export const getLines = async (globals, selector) => {
	const { page } = globals;

	const { locators, selectors } = await getChartLocators({ page }, selector);

	const { highchartsSeriesGroup } = locators;

	const { series, seriesCount } = await extractSeriesGroups(
		highchartsSeriesGroup,
		HIGHCHARTS_SPLINE_SERIES_SELECTOR,
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
