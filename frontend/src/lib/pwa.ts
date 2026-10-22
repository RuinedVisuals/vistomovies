import {registerSW} from 'virtual:pwa-register';
/** A new service worker waits until the user accepts (UpdateToast), so the page never changes under their hands. */
export const applyUpdate=registerSW({onNeedRefresh(){window.dispatchEvent(new Event('visto:update'))}});
