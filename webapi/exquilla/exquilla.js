var {Services} = ChromeUtils.import("resource://gre/modules/Services.jsm");
var {MailServices} = ChromeUtils.import("resource:///modules/MailServices.jsm");
var {OpenManualAccountCreation} = ChromeUtils.import("resource://tbsync/License.jsm");
var {Utils} = ChromeUtils.import("resource://tbsync/ewsUtils.jsm");

var _log = null;
XPCOMUtils.defineLazyGetter(this, "log", () => {
  if (!_log) {
    let { configureLogging } = ChromeUtils.import("resource://tbsync/ewsUtils.jsm").Utils;
    _log = configureLogging("webapi");
  }
  return _log;
});

/**
 * Wraps any exceptions thrown by functions used by the settings page.
 *
 * @parameter aFuncton {Function} The function to wrap
 * @returns            {Function}
 *   @throws           {ExtensionError}
 *
 * The exceptions are logged and then everything except the message is
 * dropped as the exception has to be converted into an ExtensionError.
 */
function wrapExceptions(aFunction) {
  return async (...args) => {
    try {
      return await aFunction(...args);
    } catch (ex) {
      log.error(ex);
      throw new ExtensionUtils.ExtensionError(ex.message);
    }
  };
}

this.exquillaSettings = class extends ExtensionAPI {
  getAPI(context) {
    return {
      exquillaSettings: {
        openManualAccountCreation: wrapExceptions(Utils.openAccountWizard)
      }
    };
  }
};
