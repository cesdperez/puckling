import { mount } from '@geastack/core'
import { App } from './App'
import './styles.css'

// A browser canvas does not start a webfont load on its own, so the sim would draw
// the fallback face. The device bakes atlases instead and has no FontFaceSet.
const host = globalThis as unknown as { document?: { fonts?: { load(font: string): unknown } } }
if (host.document?.fonts) for (const font of ['13px Inter', '16px Inter', '20px Inter', '26px Inter', '40px InterDisplay', '64px InterDisplay']) void host.document.fonts.load(font)

mount(App)
