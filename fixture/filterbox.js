// NIO_COMPONENT ui.platform

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
import { expect } from '@mobileum/playwright';

const FILTERBOX_CONTAINER = '.filter-tokenizer-container';
const FILTERBOX_INPUT_GROUP = '.filter-input-group';
const FILTERBOX_TYPEAHEAD_TOKEN = '.typeahead-token';
const FILTERBOX_DISABLED = '.SelectBox--is-disabled';

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
 * @param filterBox
 * @param options
 * @returns {Promise<*>}
 */
const getValueAt = async (value, filterBox, options) => {
	let num = Number(value.replaceAll(PRE_POST_FIX, ''));

	const valuesToSelect = await filterBox.locator(SELECTBOX_OPTION, options).allInnerTexts();
	const firstValue = String(valuesToSelect[0]);

	if (firstValue.toLowerCase() === 'select all') {
		num = num + 1;
	}

	return valuesToSelect[num];
};

/**
 * get the filterbox locator
 *
 * @param globals
 * @param parent
 * @param options
 * @returns {Promise<*>}
 */
const getByFilterBox = async (globals, parent, options = {}) => {
	const { page } = globals;

	const parentLocator = parent || page;

	return parentLocator.locator(FILTERBOX_CONTAINER, options);
};

/**
 * add a value to a select box
 *
 * value is either a string or a number or
 * a special value starting and ending with PRE_POST_FIX to explain that it is an index.
 * f.e:
 * - ___13___ means the 13th element in the options
 * - while 13 just means the string/number 13
 * *
 * @param globals
 * @param parent
 * @param value
 * @param options
 * @returns {Promise<void>}
 */
const addToFilterBox = async (globals, parent, name, value, options = {}) => {
	const filterBox = await getByFilterBox(globals, parent);
	const placeHolder = filterBox.locator(SELECTBOX_PLACEHOLDER, options);
	const inputContainer = filterBox.locator(SELECTBOX_INPUT, options);
	const valueContainer = filterBox.locator(SELECTBOX_VALUE, options);

	const { locator, locatorName } = await waitForLocators(
		[placeHolder, inputContainer, valueContainer],
		['placeholder', 'inputContainer', 'valueContainer'],
		options,
	);

	if (!locator || !locatorName) {
		console.log('could not find any of the filterbox elements to select: ' + value + ' at ' + name);
		return;
	}

	await expect(selectBox.locator(FILTERBOX_DISABLED)).toBeHidden();

	await locator.click();

	let nameToSelect = value;

	if (typeof value === 'string' && value.startsWith(PRE_POST_FIX) && value.endsWith(PRE_POST_FIX)) {
		nameToSelect = await getValueAt(value, filterBox, options);
	}

	const filterBoxName = await filterBox
		.locator(SELECTBOX_MENU, options)
		.getByText(new RegExp('^' + valueToSelect + '$', 'i'));

	if (filterBoxValue) {
		await filterBoxValue.click();
	}

	let valueToSelect = value;

	if (typeof value === 'string' && value.startsWith(PRE_POST_FIX) && value.endsWith(PRE_POST_FIX)) {
		valueToSelect = await getValueAt(value, filterBox, options);
	}

	const filterBoxValue = await filterBox
		.locator(SELECTBOX_MENU, options)
		.getByText(new RegExp('^' + valueToSelect + '$', 'i'));

	if (filterBoxValue) {
		await filterBoxValue.click();
	}
};

/**
 * add the nth element of the filterbox options to the filterbox
 *
 * @param globals
 * @param parent
 * @param num
 * @param options
 * @returns {Promise<void>}
 */
const addToFilterBoxAt = async (globals, parent, num, options = {}) => {
	await addToFilterBox(globals, parent, getAt(num), options);
};

/**
 * remove a value from the filterbox
 *
 * @param globals
 * @param parent
 * @param value
 * @param options
 * @returns {Promise<void>}
 */
const removeFromFilterBox = async (globals, parent, value, options = {}) => {
	const { page } = globals;
	const filterBox = await getByFilterBox(globals, parent, options);
	const selectedValue = filterBox
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
 * registers the filterbox functions at the global page object
 *
 * @param globals
 * @returns {*&{test: *, selectors}}
 */
export const registerFilterBox = globals => {
	const { test, selectors } = globals;

	const newTest = test.extend({
		page: async ({ page }, use) => {
			await use(
				Object.assign(page, {
					getByFilterBox: parent => getByFilterBox({ page }, parent),
					addToFilterBox: (parent, name, value, options) =>
						addToFilterBox({ page }, parent, name, value, options),
					addToFilterBoxAt: (parent, name, num, options) =>
						addToFilterBoxAt({ page }, parent, name, num, options),
					removeFromFilterBox: (parent, name, value, options) =>
						removeFromFilterBox({ page }, parent, value, options),
				}),
			);
		},
	});

	return { ...globals, selectors, test: newTest };
};
