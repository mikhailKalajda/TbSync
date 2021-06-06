const kMinimumRenew = 14 * 24 * 60 * 60 * 1000; // 2 weeks

let logError = console.error; // XXX TODO
let gBundle = null;

async function onInit() {
  try {
    gBundle = new StringBundle("settings");
    translateElements(document, gBundle);
    if (window.location.protocol == "chrome:") {
      window.browser = ChromeUtils.import("resource://tbsync/License.jsm");
      var { AppConstants } = ChromeUtils.import("resource://gre/modules/AppConstants.jsm");

      document.title = title.textContent = gBundle.get(AppConstants.XP_UNIX ? "windowTitle" : "windowTitleWin");
    } else {
      window.browser = window.browser.extension.getBackgroundPage().browser; // XXX Hack for Thunderbird 78
      title.remove();
    }

    manual.onclick = openManualAccountCreation;
  } catch (ex) {
    logError(ex);
  }
}
document.addEventListener("DOMContentLoaded", onInit);

function onUnload() {
}
document.addEventListener("unload", onUnload);

function openPurchasePage() {
}

function openManualAccountCreation() {
  try {
    browser.exquillaSettings.openManualAccountCreation();
  } catch (ex) {
    showError(ex);
  }
}

function showError(ex) {
  logError(ex);
  alert(ex.message || ex);
}
