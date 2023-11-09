import { readFile, writeFile, unlink, mkdir } from 'fs/promises'
import puppeteer from 'puppeteer';
import type { Browser, HTTPRequest, Page } from 'puppeteer';
import { proxyPageMethods } from './utils';
export type { Page } from 'puppeteer'

export type BlockChecker = (page: Page, setIsSolvingCaptcha: SetIsSolvingCaptcha) => Promise<boolean>
const noOpBlockChecker: BlockChecker = async () => false

const FINGERPRINTS_DIR = "fingerprints"

export type Persona = {
    userAgent: string,
    width: number,
    height: number,
}

export type PersonaGenerator = (...args: Array<any>) => Persona
export type SetIsSolvingCaptcha = (state: boolean) => void

export class PuppeteerPersonas {
    private id: string;
    private persona: Persona;
    private browser: Browser;
    public isBlocked: boolean = false
    public isSolvingCaptcha: boolean

    private constructor(id: string, persona: Persona, browser: Browser) {
        this.id = id
        this.persona = persona
        this.browser = browser
        this.isSolvingCaptcha = false
    }

    static async create(personaGenerator: PersonaGenerator, id: string) {
        let storedPersona: undefined | Persona = undefined
        // try to load from store
        try {
            const stringifiedPersonaJSON = await readFile(`${FINGERPRINTS_DIR}/${id}.json`, 'utf8')
            storedPersona = JSON.parse(stringifiedPersonaJSON)
        } catch (err) {
            console.log(`No existing fingerprint for ${id}. Creating new fingerprint.`)
        }
        let persona = storedPersona ? storedPersona : await personaGenerator()

        const browser = await puppeteer.launch();
        return new PuppeteerPersonas(id, persona, browser)
    }

    public setIsSolvingCaptcha(isSolvingCaptcha: boolean) {
        this.isSolvingCaptcha = isSolvingCaptcha
    }

    public async teardown() {
        await this.browser.close()
    }

    private async storePersona() {
        await mkdir(FINGERPRINTS_DIR, { recursive: true })
        await writeFile(`${FINGERPRINTS_DIR}/${this.id}.json`, JSON.stringify(this.persona));
    }

    private async storeCookies(page: Page) {
        const cookies = await page.cookies();
        await writeFile(`${FINGERPRINTS_DIR}/${this.id}.cookies.json`, JSON.stringify(cookies, null, 2));
    }

    private async removePersona() {
        try {
            await unlink(`${FINGERPRINTS_DIR}/${this.id}.json`)
        } catch { }
        try {
            await unlink(`${FINGERPRINTS_DIR}/${this.id}.cookies.json`)
        } catch { }
    }

    private async setPersonaToPage(persona: Persona, page: Page) {
        await page.setViewport({ width: persona.width, height: persona.height });
        await page.setUserAgent(persona.userAgent)
    }

    async newPage(blockChecker: BlockChecker = noOpBlockChecker): Promise<Page> {
        const page = await this.browser.newPage()
        await this.setPersonaToPage(this.persona, page)

        await page.setRequestInterception(true)
        page.on('request', async (req) => this.trackCookies(req, page));

        const proxyPage = proxyPageMethods(page, this)
        page.on('load', async () => {
            // use page for isBlocked check so it can also attempt to solve captcha, instead of getting caught in proxyPage
            const isBlocked = await blockChecker(page, this.setIsSolvingCaptcha)
            if (!isBlocked) {
                console.log('Not currently blocked. Persist fingerprint.')
                return this.storePersona()
            }

            await this.removePersona()
            this.isBlocked = true
        })
        return proxyPage
    }

    // attempt to load cookies from disk if we don't have any, otherwise persist updated cookies
    private async trackCookies(req: HTTPRequest, page: Page) {
        const existingCookies = await page.cookies();
        if (existingCookies.length !== 0) {
            try {
                const cookieString = await readFile(`${FINGERPRINTS_DIR}/${this.id}.cookies.json`, "utf8");
                const cookies = JSON.parse(cookieString)
                await page.setCookie.apply(page, cookies);
            } catch { }
        }
        else {
            await this.storeCookies(page)
        }
        req.continue();
    }
}

