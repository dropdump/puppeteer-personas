import type { ElementHandle } from "puppeteer"
import { PuppeteerPersonas } from "./lib/Browser"
import type { BlockChecker, Page, PersonaGenerator, SetIsSolvingCaptcha } from "./lib/Browser"

const solveCaptcha = async (setIsSolvingCaptcha: SetIsSolvingCaptcha, page: Page): Promise<boolean> => {
    // prevent other page methods from continuing
    setIsSolvingCaptcha(true)

    /* implementation to solve captcha*/
    await new Promise(resolve => setTimeout(resolve, 10000))

    // Allow other page methods to continue
    setIsSolvingCaptcha(false)    
    return true
}

const iFrameSrc = async (page: Page) => page.evaluate(() => {
    const iframe = document.querySelector('iframe#main-iframe')
    if (iframe && "src" in iframe)
        return iframe.src
})

/* Implement your custom BlockChecker logic. e.g. detect Incapsula IFrame */
const incapsulaBlockChecker: BlockChecker = async (page: Page, setIsSolvingCaptcha: SetIsSolvingCaptcha) => {  
    const iframeSrc = await iFrameSrc(page)
    if (!iframeSrc || typeof iframeSrc !== "string" ){
        return false
    } 

    const maybeBlocked = (iframeSrc.includes('_Incapsula_'))
    if (!maybeBlocked) {
        return false
    }

    if (iframeSrc.includes("edet=15")) {
        true
    }
    return solveCaptcha(setIsSolvingCaptcha, page)
}  



const userAgents = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36"
] as const

const MIN_WIDTH = 480
const MAX_WIDTH = 1920
const MIN_HEIGHT = 720
const MAX_HEIGHT = 1080

type NonEmptyArray<T> = [T, ...T[]];

const randFromArray = <T>(items: NonEmptyArray<T>): T => items[Math.floor(Math.random()*items.length)]

const randIntBetween = (min: number, max: number): number => Math.floor(
    Math.random() * (max - min) + min
)

const personaGenerator: PersonaGenerator = () => {
    return {
        userAgent: randFromArray(userAgents),
        width: randIntBetween(MIN_WIDTH, MAX_WIDTH),
        height: randIntBetween(MIN_HEIGHT, MAX_HEIGHT),
    }
} 

const personaId = `persona-id-123`
const personaManager = await PuppeteerPersonas.create(personaGenerator, personaId)

const page = await personaManager.newPage( incapsulaBlockChecker )

await page.goto('fqdn-of-imperva-page')
await page.waitForNavigation({ waitUntil: 'networkidle2' })

// Here we are possibly caught in the captcha after navigation but we don't have to write 
// any handling other than defining the custom BlockChecker passed to the newPage

const buttonSelector = await page.$('#button-id-in-page') as ElementHandle<Element>
await buttonSelector.click()