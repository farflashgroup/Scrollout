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
import { chromium } from '@playwright/test';


export async function extensionContext(profile:string,extension:string,options:NonNullable<Parameters<typeof chromium.launchPersistentContext>[1]>) {
  // Loading at startup and then through CDP can race, replacing the worker
  // after a test has connected to it. Pick one loader per browser context.
  const context=await chromium.launchPersistentContext(profile,{...options,args:[...(options.args??[]),'--enable-unsafe-extension-debugging']});
  try {
    const cdp=await context.browser()!.newBrowserCDPSession();
    await cdp.send('Extensions.loadUnpacked',{path:extension});
    return {context,legacyActions:false};
  } catch(error) {
    await context.close();
    if(!/wasn't found|not found|Unknown method/.test(String(error)))throw error;
    // Chrome 120 predates the CDP loader and still accepts the startup flag.
    return {context:await chromium.launchPersistentContext(profile,{...options,args:[...(options.args??[]),`--load-extension=${extension}`]}),legacyActions:true};
  }
}
