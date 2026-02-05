// NIO_COMPONENT ui.platform

import { getChartLocators } from './highcharts/common';
import { getLines } from './highcharts/lines';
import { getBars, getBarAt, getHorizontalBarAt, getHorizontalBars } from './highcharts/bars';
import { getPies } from './highcharts/pies';

export const registerHighcharts = globals => {
	const { test, selectors } = globals;

	const newTest = test.extend({
		page: async ({ page }, use) => {
			await use(
				Object.assign(page, {
					getChartLocators: (selector, options) => getChartLocators({ page }, selector, options),
					getLines: (selector, options) => getLines({ page }, selector, options),
					getBars: (selector, options) => getBars({ page }, selector, options),
					getBarAt: (selector, num, options) => getBarAt({ page }, selector, num, options),
					getPies: (selector, options) => getPies({ page }, selector, options),
				}),
			);
		},
	});

	return { ...globals, selectors, test: newTest };
};
