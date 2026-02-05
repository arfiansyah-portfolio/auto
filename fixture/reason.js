import { expect } from '@mobileum/playwright';
import getConfig from '@mobileum/utils/common/getConfig';


// searching a subscriber
const getBySubscriberSearch = async (globals, subscriberId, reasonType, caseReference, reasonNote = {}) => {
	const { page, testInfo } = globals;

	const searchInput = page.locator('#search-input');
	const statementReasonForSearch = page.getByText('Statement of Reason for ID Search');
	const reasonTypeSelector =
		'#overlay > div > div.reasons-form-container > form > div > div:nth-child(1) > div > div > label > select';
	const caseReferenceInput = page.locator('textarea[name="caseReference"]');
	const reasonNoteInput = page.locator('textarea[name="reasonNote"]');
	const searchButton = page.getByRole('button', { name: 'Submit' });
	const searchIconButton = page.locator('#overlay').getByRole('button');

	if (await statementReasonForSearch.isVisible()) {
		await searchInput.fill(subscriberId);
		await page.selectOption(reasonTypeSelector, { value: reasonType });
		await caseReferenceInput.fill(caseReference);
		await reasonNoteInput.fill(reasonNote);

		await testInfo.attach('Input reason for search', {
			body: await page.screenshot(),
			contentType: 'image/png',
		});

		await searchButton.click();
	} else {
		await searchInput.fill(subscriberId);

		await testInfo.attach('Input subscriber number', {
			body: await page.screenshot(),
			contentType: 'image/png',
		});

		await searchIconButton.click();
	}
};

export const registerSubscriberSearch = (globals) => {
	const { test, expect } = globals;

	const newTest = test.extend({
		page: async ({ page }, use, testInfo) => {
			await use(
				Object.assign(page, {
					getBySubscriberSearch: (subscriberId, reasonType, caseReference, reasonNote) =>
						getBySubscriberSearch({ page, testInfo }, subscriberId, reasonType, caseReference, reasonNote),
				}),
			);
		},
	});

	return { ...globals, test: newTest };
};
