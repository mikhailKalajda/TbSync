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
var { setTimeout, setInterval, clearInterval } = ChromeUtils.import("resource://gre/modules/Timer.jsm");
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

const kSoonExpiringPollInterval = 24 * 60 * 60 * 1000; // 1 day
const kSoonExpiring = 14 * 24 * 60 * 60 * 1000; // 2 weeks
const kOld = -14 * 24 * 60 * 60 * 1000; // 2 weeks ago

const kGetLicenseURL = "https://www.exquilla.com/?";
const kLicenseServerURL = "https://api.beonex.com/exquilla-license/";
const kPublicKey = "data:application/octet-stream;base64,MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAuqQSFfW5+O5xYfGJiArAMQ/RJ2PFe6W3uoy8lfdVEYOg3RMkzDOl5zosr/8IzDztBpVNmsSsBZb90BsSoBL+41vIv2hN2AEsWcUBN6S5LZDDCxxYs1QFzxIMDx+RiKSP1KbhWXx+VGJr6BMgctx/gzrSaQVzBtF+HEEnd1Umpm8hhOyloqySAo8sOjQ48sP517jXvy4Vv8oscVvqUdbITBEzOjW1UxSPMBcexeeRLd/S0T6eAwwtK2y0Rop2kjKpC7FcA0or10MpBY4DSii/gqtpl91yV8s9dgUpPuxkm86r0IUkRG6HMz7LJCsvPeBVf9kllyCHiytLzz2FUrnQpQIDAQAB";

/// The crypto key for verifying ticket signatures
var gKeyPromise = null;
/// Cache in EnsureLicensed() to avoid re-validating the ticket cryptographically for every server call
var gLastTicket = false;
/// A promise that resolves when a ticket refresh finishes
var gFetchingTicket = null;
/// Whether this user is known to have had a trial license
var gHadTrial = false;


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
