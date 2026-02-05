// NIO_COMPONENT ui.platform
/**
 * get the table headers locators array from the datagrid table
 * @param gridLocator
 * @returns {Promise<*[string]>}
 */
export const getTableHeaderLocators = async gridLocator => {
	return await gridLocator.getByRole('columnheader').all();
};

export const getTableHeaderTexts = async gridLocator => {
	const allHeaderLocators = await getTableHeaderLocators(gridLocator);

	const headers = [];

	for (let i = 0; i < allHeaderLocators.length; i++) {
		const headerName = await allHeaderLocators[i]
			.locator('.datagrid-header span')
			.first()
			.innerText();

		headers.push(headerName);
	}

	return headers;
};

const MAX_LOOP = 50;
const SCROLL_X_PIXELS = 200;

/**
 * be sure to have the expected header in view
 * @param gridLocator
 * @param headerName
 * @returns {Promise<boolean>}
 */
export const findAndScrollTableHeaderIntoView = async (gridLocator, headerName) => {
	let found = false;
	let count = 0;
	let lastHeader = '';

	const gridBoundingBox = await gridLocator.boundingBox();
	const gridWidth = gridBoundingBox.width ? gridBoundingBox.width - 20 : SCROLL_X_PIXELS;
	const scrollWidth = gridWidth > SCROLL_X_PIXELS ? gridWidth : SCROLL_X_PIXELS;

	while (!found && count < MAX_LOOP) {
		const headerLocators = await getTableHeaderLocators(gridLocator);
		const headerTexts = await getTableHeaderTexts(gridLocator);

		if (headerLocators.length === 0) {
			console.info('no headers found');
			break;
		}

		const lastHeaderLocator = headerLocators[headerLocators.length - 1];

		if (headerTexts.includes(headerName)) {
			console.info(`searched for header ${headerName} found`);
			found = true;
		}

		const newLastHeader = headerTexts[headerTexts.length - 1];

		// in case we have reached the end of the scrollable columns, we stop
		if (newLastHeader === lastHeader) {
			console.info(`searched for header ${headerName} not found`);
			break;
		}

		await lastHeaderLocator.focus();
		await lastHeaderLocator.dispatchEvent('wheel', { deltaX: scrollWidth });
		lastHeader = newLastHeader;
		count++;
	}

	return found;
};

/**
 * get the index of a column in the datagrid table by its name (or an integer index itself)
 * @param gridLocator
 * @param headerName
 * @returns {Promise<number>}
 */
export const getTableColumnIndex = async (gridLocator, headerName) => {
	const headers = await getTableHeaderTexts(gridLocator);

	return headers.indexOf(headerName);
};

/**
 * get the row of datagrid at a certain index
 * @param gridLocator
 * @param rowIndex
 * @returns {*}
 */
export const getTableRowAt = (gridLocator, rowIndex) => gridLocator.getByRole('row').nth(rowIndex);

/**
 * get the value of a specific cell in the datagrid table by row and column index or name (or an integer index itself)
 * @param gridLocator
 * @param rowIndex
 * @param headerNameOrIndex
 * @returns {Promise<string>}
 */
export const getTableCellAt = async (gridLocator, rowIndex, headerNameOrIndex) => {
	let index = -1;

	if (typeof headerNameOrIndex === 'string') {
		index = await getTableColumnIndex(gridLocator, headerNameOrIndex);
	} else {
		index = headerNameOrIndex;
	}

	const rowLocator = await getTableRowAt(gridLocator, rowIndex);

	return await rowLocator.getByRole('gridcell').nth(index);
};

/**
 * get a specific cell in the datagrid table by row and column index or name (or an integer index itself)
 * @param gridLocator
 * @param row
 * @param headerNameOrIndex
 * @returns {Promise<string>}
 */
export const getTableValueAt = async (gridLocator, row, headerNameOrIndex) => {
	const cellLocator = await getTableCellAt(gridLocator, row, headerNameOrIndex);

	return await cellLocator.innerText();
};

export const registerTables = globals => {
	const { test, selectors } = globals;

	const newTest = test.extend({
		page: async ({ page }, use) => {
			await use(
				Object.assign(page, {
					getTableCellAt: name => getTableCellAt({ page }, name),
				}),
			);
		},
	});

	return { ...globals, selectors, test: newTest };
};
