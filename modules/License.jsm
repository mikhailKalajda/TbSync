/* ***** ATTENTION CRACKERS *****
 *
 * Yes, it is all here, everything that you need to remove ExQuilla licenses.
 *
 * In case you are not aware, I have put much of my time into helping create
 * Thunderbird, and this addon is how I pay for my work and how I can live.
 * So how about a little favor. Just use your cleverness to use ExQuilla
 * yourself for free, and don't use the information here to broadly "help"
 * the rest of the world with cracked versions. After all, Thunderbird is free
 * due to the efforts of people like me and others. So please just help
 * yourself without adding your own effort to bring everything down
 * by undermining my source of income.
 *
 * If you really want to help the cause of free software, since you were
 * clever enough to find this code, why don't you come join us and help
 * build a better Thunderbird? Heck, I'll even give you a free legitimate
 * ExQuilla license if you just help a little with the core product!
 *
 * Ben Bucksch
 * ExQuilla developer and core Thunderbird developer
 */

var { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { setTimeout } = ChromeUtils.import("resource://gre/modules/Timer.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");
var { Utils } = ChromeUtils.import("resource://tbsync/ewsUtils.jsm");
Utils.importLocally(this);

var _log = null;
XPCOMUtils.defineLazyGetter(this, "log", () => {
  if (!_log) {
    _log = configureLogging("license");
  }
  return _log;
});

Cu.importGlobalProperties(["crypto", "fetch", "URLSearchParams"]);

var EXPORTED_SYMBOLS = ["OpenPurchasePage", "exquillaSettings"];

function getGlobalPrimaryIdentity() {
  try {
    let identity = MailServices.accounts.defaultAccount.defaultIdentity;
    if (identity.email) {
      return identity;
    }
  } catch (ex) {
  }
  try {
    for (let identity of /* COMPAT for TB 68 */toArray(MailServices.accounts.allIdentities, Ci.nsIMsgIdentity)) {
      if (identity.email) {
        return identity;
      }
    }
  } catch (ex) {
  }
  let identity = { email: "", fullName: "" };
  let userInfo = Cc["@mozilla.org/userinfo;1"].getService(Ci.nsIUserInfo);
  try {
    identity.email = userInfo.emailAddress;
  } catch (ex) {
  }
  try {
    identity.fullName = userInfo.fullname;
  } catch (ex) {
  }
  return identity;
}

function BadTicket(status) {
  this.expiredIn = 0;
  this.valid = false;
  this.status = status || "missing";
}

/**
 * Logs any exceptions thrown by functions used by the settings page.
 *
 * @parameter aFuncton {Function} The function to wrap
 * @returns            {Function}
 *
 * This is here because the settings page doesn't have access to logging,
 * and the equivalent function in webapi/exquilla/exquilla.js has to drop
 * everything except the exception message anyway.
 */
function wrapExceptions(aFunction) {
  return async (...args) => {
    try {
      return await aFunction(...args);
    } catch (ex) {
      log.error(ex);
      throw ex;
    }
  };
}

/**
 * This object mirrors the `exquillaSettings` WebExperiment API.
 */
var exquillaSettings = {
  openManualAccountCreation: wrapExceptions(openAccountWizard)
};
