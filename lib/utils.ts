import { Page, PuppeteerPersonas } from "./Browser";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export function proxyPageMethods(page: Page, browserManager: PuppeteerPersonas): Page {
    return new Proxy<Page>(page, {
        get(target, prop) {
            const origMethod = target[prop];
            if (typeof origMethod !== 'function') {
                return origMethod
            }
            return async (...args: any[]) => {
                while (browserManager.isSolvingCaptcha) {
                    await delay(500)
                }
                if (browserManager.isBlocked) {
                    await browserManager.teardown()
                    throw new Error("Blocked")
                }
                return origMethod.apply(target, args)
            }

        }
    })
}
