// NIO_COMPONENT ui.platform
import { saveSystemConfig, getSystemConfig } from '../utils/common/systemConfig';
import { saveCurrentPermissions, hasPermission } from '../utils/common/permissions';

export const registerPlatform = (globals) => {
	const { test, ...rest } = globals;
	return {
		...rest,
		test: test.extend({
			saveSystemConfig: async ({ page }, use) => {
				await use(() => saveSystemConfig(page));
			},
			saveCurrentPermissions: async ({ page }, use) => {
				await use(() => saveCurrentPermissions(page));
			},
			getSystemConfig: ({}, use) => use(getSystemConfig),
			hasPermission: ({}, use) => use(hasPermission),
		}),
	};
};

export const beforeEachFactory =
	(test) =>
	(accessMap = {}, options = {}) => {
		const { verbose = false } = options;

		test.beforeEach(async ({ getSystemConfig, hasPermission }, testInfo) => {
			const testTitle = testInfo.titlePath.slice(-1)[0];

			// check system configs
			const requiredSystemConfigs = accessMap[testTitle]?.config;
			if (Array.isArray(requiredSystemConfigs)) {
				const nonMatchingSystemConfig = requiredSystemConfigs.find(([configKey, configValue]) => {
					const value = getSystemConfig(configKey);
					// special config value
					// - _exist_ -> non-matching if value doesnt exist (undefined/null/empty string)
					// - _!exist_ -> non-matching if value exists (not undefined/null/empty string)
					const valueExists = ![undefined, null, ''].includes(value);
					switch (configValue) {
						case '_exist_':
							return !valueExists;
						case '!_exist_':
							return valueExists;
						default:
							return getSystemConfig(configKey) !== configValue;
					}
				});
				if (nonMatchingSystemConfig) {
					const [configKey, configValue] = nonMatchingSystemConfig;
					verbose &&
						console.info(
							`${testTitle} skipped based on configuration ${configKey}. expected: ${configValue}, received: ${getSystemConfig(
								configKey,
							)}`,
						);
					test.skip();
					return;
				}
			}

			// check permissions
			const requiredPermissions = accessMap[testTitle]?.permissions;
			if (Array.isArray(requiredPermissions)) {
				const missingPermissions = requiredPermissions.filter((permission) => !hasPermission(permission));
				if (missingPermissions.length) {
					verbose && console.info(`${testTitle} skipped based on missing permissions`, missingPermissions);
					test.skip();
					return;
				}
			}
		});
	};
