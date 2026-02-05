// NIO_COMPONENT ui.platform

import { test as testBase, selectors as selectorsBase, expect as expectBase } from '@playwright/test';
// import { registerDatepicker } from './datepicker';
import { registerPlatform, beforeEachFactory } from './platform';
// import { registerSelectBox } from './selectbox';
// import { registerFilterBox } from './filterbox';
// import { registerHighcharts } from './highcharts';
// import { registerSubscriberSearch } from './reason';
// import { registerTables } from './tables';
// import { registerCSS } from './css';
import { registerXray, uploadToXray } from './xray-fixtures'; // Import Register Function

let globals = { test: testBase, selectors: selectorsBase, expect: expectBase };

globals = registerPlatform(globals);
globals = registerXray(globals); // Chain Xray
// globals = registerSelectBox(globals);
// globals = registerFilterBox(globals);
// globals = registerDatepicker(globals);
// globals = registerHighcharts(globals);
// globals = registerSubscriberSearch(globals);
// globals = registerTables(globals);
// globals = registerCSS(globals);

const { test, selectors, expect } = globals;
const beforeEach = beforeEachFactory(test);

export { test, selectors, expect, beforeEach, uploadToXray };

export default {
	test,
	selectors,
	expect,
	beforeEach,
};
