// NIO_COMPONENT ui.platform

const CLASSES = {
	DATERANGE_CONTAINER: '.date-range-picker-container',
	DISABLED_DAY: 'rdp-day_disabled',
	SELECTED_DAY: 'rdp-day_selected',
};

const openDatepicker = async (globals, options = {}) => {
	const { page, expect } = globals || {};
	const { name, container } = options || {};

	/**
	 * FIXME:
	 * - current selection based on the datepicker button label, doesn't cover cases where it doesn't have label
	 * - this locator is still not standardized between workspaces (only confirmed for Explorer)
	 */
	const locatorString = [container || null, `label:text("${name}") + span [type="button"]`].filter(Boolean).join(' ');
	const daterangeButton = page.locator(locatorString);
	await expect(daterangeButton).toBeVisible();
	await daterangeButton.click();

	const daterangePicker = page.locator(CLASSES.DATERANGE_CONTAINER);
	return daterangePicker;
};

const selectDaterange = async (daterangePicker, options = {}) => {
	const { startIndex = -2, endIndex = -1, verbose = false } = options;

	// throw if there's no available dates
	const dates = daterangePicker.locator(`button.rdp-button:not(.${CLASSES.DISABLED_DAY})`);
	const datesCount = await dates.count();
	verbose && console.info('Available dates:', datesCount);
	if (datesCount === 0) {
		throw new Error('No available dates');
	}

	const startDate = dates.nth(startIndex);
	const endDate = dates.nth(endIndex);
	await startDate.click();
	await endDate.click();

	return [startDate, endDate];
};

const assertSelectedDaterange = async (expect, startDate, endDate) => {
	await expect(startDate).toHaveClass(new RegExp(CLASSES.SELECTED_DAY));
	await expect(endDate).toHaveClass(new RegExp(CLASSES.SELECTED_DAY));
};

export const registerDatepicker = (globals) => {
	const { test, expect } = globals;

	const newTest = test.extend({
		page: async ({ page }, use) => {
			await use(
				Object.assign(page, {
					openDatepicker: (name, container) => openDatepicker({ page, expect }, { name, container }),
					selectDaterange,
					assertSelectedDaterange,
				}),
			);
		},
	});

	return { ...globals, test: newTest };
};

export default registerDatepicker;
