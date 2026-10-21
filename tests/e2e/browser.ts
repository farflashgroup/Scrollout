// All contexts, including editor page fixtures, must use the selected browser.
export const testPort=Number(process.env.SCROLLOUT_QA_PORT||4173);
if(!Number.isInteger(testPort)||testPort<1024||testPort>65535)throw Error('Invalid QA port');
export const testBaseUrl=`http://127.0.0.1:${testPort}`;
export const browserOptions = process.env.SCROLLOUT_QA_CHROME
  ? { executablePath: process.env.SCROLLOUT_QA_CHROME }
  : { channel: 'chromium' };

// Chrome 120's default headless mode does not load extensions.
export const browserArgs = ['--headless=new', '--force-device-scale-factor=1'];

// captureVisibleTab in Chrome 120 captures the native window, ignoring CDP's
// emulated viewport. Exercise real window pixels and real display scaling.
export function captureArgs(scale = 1) {
  return ['--headless=new', `--force-device-scale-factor=${scale}`, '--window-size=916,838'];
}
