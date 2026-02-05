// NIO_COMPONENT ui.platform
import { expect } from '@mobileum/playwright';
import { waitForLocators } from '../utils/common/locators';
import {
	SELECTBOX_INPUT,
	SELECTBOX_OPTION,
	SELECTBOX_PLACEHOLDER,
	SELECTBOX_VALUE,
	SELECTBOX_MULTI_VALUE,
	SELECTBOX_MULTI_VALUE_LABEL,
	SELECTBOX_MENU,
	PRE_POST_FIX,
	SELECTBOX_LOADING_INDICATOR,
} from './constants';

const REACT_SELECT_CONTAINER = '.react-select-container';

/**
 * format the *at* value
 * wraps the number in PRE_POST_FIX underscores
 *
 * @param num
 * @returns {string}
 */
const getAt = num => PRE_POST_FIX + String(num) + PRE_POST_FIX;

/**
 * gets the value at the given index
 * discards the select all option
 *
 * @param value
 * @param selectBox
 * @param options
 * @returns {Promise<*>}
 */
const getValueAt = async (value, selectBox, options) => {
	let num = Number(value.replaceAll(PRE_POST_FIX, ''));

	const valuesToSelect = await selectBox.locator(SELECTBOX_OPTION, options).allInnerTexts();
	const firstValue = String(valuesToSelect[0]);

	if (firstValue.toLowerCase() === 'select all') {
		num = num + 1;
	}

	return valuesToSelect[num];
};

/**
 * get the selectbox locator
 *
 * @param globals
 * @param name
 * @param options
 * @returns {Promise<*>}
 */
const getBySelectBox = async (globals, name, options = {}) => {
	const { page } = globals;

	const labelSelector = await page.locator('label', options).filter({ hasText: new RegExp(`^${name}$`)  });
	const parentOfLabel = await labelSelector.locator('..', options);

	return parentOfLabel.locator(REACT_SELECT_CONTAINER, options);
};

/**
 * add a value to a select box
 *
 * value is either a string or a number or
 * a special value starting and ending with PRE_POST_FIX to explain that it is an index.
 * f.e:
 * - ___13___ means the 13th element in the options
 * - while 13 just means the string/number 13
 *
 * @param globals
 * @param name
 * @param value
 * @param options
 * @returns {Promise<void>}
 */
const addToSelectBox = async (globals, name, value, options = {}) => {
	const selectBox = await getBySelectBox(globals, name);
	const placeHolder = selectBox.locator(SELECTBOX_PLACEHOLDER, options);
	const inputContainer = selectBox.locator(SELECTBOX_INPUT, options);
	const valueContainer = selectBox.locator(SELECTBOX_VALUE, options);

	// check for any of the available elements to be present to click on it
	const { locator, locatorName } = await waitForLocators(
		[placeHolder, inputContainer, valueContainer],
		['placeholder', 'inputContainer', 'valueContainer'],
		options,
	);

	if (!locator || !locatorName) {
		console.log('Could not find any of the selectbox elements to select: ' + value + ' at ' + name);
		return;
	} else {
	}

	// before clicking check if the enums are still loading
	await expect(selectBox.locator(SELECTBOX_LOADING_INDICATOR)).toBeHidden();

	await locator.click();

	let valueToSelect = value;

	if (typeof value === 'string' && value.startsWith(PRE_POST_FIX) && value.endsWith(PRE_POST_FIX)) {
		valueToSelect = await getValueAt(value, selectBox, options);
	}

	const selectBoxValue = await selectBox
		.locator(SELECTBOX_MENU, options)
		.getByText(new RegExp('^' + valueToSelect + '$', 'i'));

	if (selectBoxValue) {
		await selectBoxValue.click();
	}
};

/**
 * add the nth element of the selectbox options to the selectbox
 *
 * @param globals
 * @param name
 * @param num
 * @param options
 * @returns {Promise<void>}
 */
const addToSelectBoxAt = async (globals, name, num, options = {}) => {
	await addToSelectBox(globals, name, getAt(num), options);
};

/**
 * remove a value from the selectbox
 *
 * @param globals
 * @param name
 * @param value
 * @param options
 * @returns {Promise<void>}
 */
const removeFromSelectBox = async (globals, name, value, options = {}) => {
	const { page } = globals;
	const selectBox = await getBySelectBox(globals, name, options);
	const selectedValue = selectBox
		.locator(SELECTBOX_MULTI_VALUE, {
			...options,
			has: page.locator(SELECTBOX_MULTI_VALUE_LABEL, { hasText: value }),
		})
		.getByRole('button');

	if (selectedValue) {
		await selectedValue.click();
	}
};

/**
 * registers the selectbox functions at the global page object
 *
 * @param globals
 * @returns {*&{test: *, selectors}}
 */
export const registerSelectBox = globals => {
	const { test, selectors } = globals;

	const newTest = test.extend({
		page: async ({ page }, use) => {
			await use(
				Object.assign(page, {
					getBySelectBox: name => getBySelectBox({ page }, name),
					addToSelectBox: (name, value, options) => addToSelectBox({ page }, name, value, options),
					addToSelectBoxAt: (name, num, options) => addToSelectBoxAt({ page }, name, num, options),
					removeFromSelectBox: (name, value, options) => removeFromSelectBox({ page }, name, value, options),
				}),
			);
		},
	});

	return { ...globals, selectors, test: newTest };
};
