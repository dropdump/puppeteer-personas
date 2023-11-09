# Purpose
When scraping websites with aggressive bot detection `puppeteer-personas` presents a mechanism to  enabling engineers to write separate captcha- and domain-specific logic.


Under-the-hood `puppeteer-personas` creates a `Proxy object` on a puppeteer page, which intercepts calls to the page's methods and only attempts them if the browser isn't blocked or currently attempting to solve a captcha.



# Imperva example
See `example.ts` for sample implementation. To summarise:
```Typescript
...
const incapsulaBlockChecker: BlockChecker = async (page: Page, setIsSolvingCaptcha: SetIsSolvingCaptcha) => {
    /* Implement your custom BlockChecker logic. e.g. detect Incapsula IFrame */
    return true
}  

const personaGenerator: PersonaGenerator = async (): Promise<Persona> => {
    /* Implement your custom Persona generation logic */
    return fetchPersona()
} 

const personaId = `persona-id-123`
const personaManager = await PuppeteerPersonas.create(personaGenerator, personaId)

const page = await personaManager.newPage( incapsulaBlockChecker )

// navigate to page that is protected with Incapsula firewall
await page.goto('fqdn-of-imperva-page')
await page.waitForNavigation({ waitUntil: 'networkidle2' })

// Here we would normally need to handle captcha detection. But what if you aren't
// captcha-captured immediately? Perhaps we wrap everything in an error handling block.
// If you later solve the captcha, how would you recover to where you left off?
// 
// Instead, we can avoid all this complexity by passing a custom BlockChecker to the newPage 
// method, we don't have to write any handling logic and can focus only on
// scraping-specific functionality

const buttonSelector = await page.$('#button-id-in-page') as ElementHandle<Element>
await buttonSelector.click()
```