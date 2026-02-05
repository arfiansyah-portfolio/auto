export const getCSSPropertyValue = async (globals, selectorOrLocator, pseudoElement, cssProperty = 'content') => {
	const { page } = globals;

	if (typeof selectorOrLocator === 'string' && !page) {
		console.log('Please provide page object in the options object');
	}

	const elementLocator = typeof selectorOrLocator === 'string' ? page.locator(selectorOrLocator) : selectorOrLocator;
	const element = elementLocator.first();

	const styleValues = await element.evaluate(
		(argElement, argOptions) => {
			const { pseudoElement } = argOptions;

			return window.getComputedStyle(argElement, pseudoElement);
		},
		{ pseudoElement, cssProperty },
	);

	return styleValues[cssProperty];
};

export const registerCSS = globals => {
	const { test, selectors } = globals;

	const newTest = test.extend({
		page: async ({ page }, use) => {
			await use(
				Object.assign(page, {
					getCSSPropertyValue: (selectorOrLocator, pseudoElement, cssProperty) =>
						getCSSPropertyValue({ page }, selectorOrLocator, pseudoElement, cssProperty),
				}),
			);
		},
	});

	return { ...globals, selectors, test: newTest };
};
