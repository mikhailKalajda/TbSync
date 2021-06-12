const { classes: Cc, Constructor: CC, interfaces: Ci, utils: Cu, Exception: CE, results: Cr, } = Components;
var { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");

ChromeUtils.defineModuleGetter(this, "Utils",
  "resource://tbsync/ewsUtils.jsm");

ChromeUtils.defineModuleGetter(this, "JaBaseAbDirectory",
    "resource://tbsync/JaBaseAbDirectory.jsm");

ChromeUtils.defineModuleGetter(this, "JSAccountUtils", "resource://tbsync/JSAccountUtils.jsm");

var _log = null;
XPCOMUtils.defineLazyGetter(this, "log", () => {
  if (!_log) _log = Utils.configureLogging("contacts");
  return _log;
});

// Main class.
var global = this;

function EwsAbDirectory(aDelegator, aBaseInterfaces) {
    if (typeof (safeGetJS) == "undefined")
    Utils.importLocally(global);

  // Superclass constructor
  JaBaseAbDirectory.call(this, aDelegator, aBaseInterfaces);

  // We want to ensure that calls to any methods used in extraInterfaces always
  // refer to this object, and not a wrapper. We use wrap to always point to
  // the correct object to use for refering to the object. All references that
  // are called from an extra interface method or attribute must refer to
  // this.wrap and not simply this.
  this.wrap = this;

  // instance variables

  this.mNativeFolder = null;
  this.cards = null;
  this.mailLists = [];
  this.addressMap = null;
  this.mURI = null;

  // operational status
  this.gettingCardIds = false; // We don't want to get these twice if there are multiple requests
  this.gettingNewItems = false; // We don't want to get these twice if there are multiple requests
  this.updatingCard = false;
  this.resolvingNames = false;

  // todo: we need some method to update the ab when loaded

  // query-related stuff, following nsAbDirectoryRDFResource
  this.mIsQueryURI = false;
  this.mQueryString = null;
  this.mURINoQuery = null;
  this.mNoQueryDirectory = null;
  this.rebuildListener = null;
  this.getChildCardsListener = null;
  this.mIsGAL = false;
  // storage of strings for non-top level directories (that is, mailing lists)
  this.stringValues = {};
  this.startup();
}

// Extend the base properties.
EwsAbDirectory.Properties = {
    __proto__: JaBaseAbDirectory.Properties,
  
    classID: Components.ID("{62EC44B5-D647-4023-96D6-EAE7A17DCD79}"),
  
    // Add additional interfaces only needed by this custom class.
    extraInterfaces: [ Ci.nsIAbDirSearchListener ],
}

// Extend the base properties.
EwsAbDirectory.Properties = {
    __proto__: JaBaseAbDirectory.Properties,
  
    classID: Components.ID("{62EC44B5-D647-4023-96D6-EAE7A17DCD79}"),
  
    // Add additional interfaces only needed by this custom class.
    extraInterfaces: [ Ci.nsIAbDirSearchListener ],
  }

// Extend the base class methods.
EwsAbDirectory.prototype = {
    // Typical boilerplate to include in all implementations.
    __proto__: JaBaseAbDirectory.prototype,
  
    // Used to identify this as an EwsAbDirectory
    get EwsAbDirectory() {
      return this;
    },

    // InterfaceRequestor override, needed if extraInterfaces.
    getInterface: function(iid) {
        for (let iface of EwsAbDirectory.Properties.extraInterfaces) {
            if (iid.equals(iface)) {
                return this;
            }
        }
        return this.QueryInterface(iid);
    },

    // nsIAbDirectory overrides
    get childCards() {
        return new ArrayEnumerator([]);
    },

    get childNodes()
    {
        return new ArrayEnumerator([]);
    },

    get URI()
    {
        return '';
    },

    get readOnly()
    {
        return true;
    },

    useForAutocomplete: function _useForAutocomplete(aIdentityKey)
    {
        return false;
    },

    deleteDirectory: function _deleteDirectory(aDirectory)
    {
        // When we are asked to remove a directory, sometimes we just want to stop viewing it locally.
        // Calendar has the concept of "unregister" which is what we usually want to do. AbManager
        // does that when it is asked to delete, but we can't tell if calls to delete are really
        // a user wanting to remove a sub calendar, or "unregister". So for now we will do nothing.
        log.warn("request to deleteDirectory is ignored");
    },

    addMailList: function _addMailList(aDirectory)
    {
        return false;
    },

    init: function _init(aUri)
    {
    },

    modifyCard: function _modifyCard(aCard) {

    },

    addCard: function _addCard(aCard) {

    },

    deleteCards: function _deleteCards(aCards) {

    },

    dropCard: function _dropCard(aCard, aNeedToCopyCard)
    {
        // We're going to ignore the need to copy bit
        this.addCard(aCard);
    },

    setStringValue: function _setStringValue(aName, aValue) {
        this.cppBase.QueryInterface(Ci.nsIAbDirectory).setStringValue(aName, aValue);
    },

    getStringValue: function _getStringValue(aName, aDefaultValue) {
        return this.cppBase.QueryInterface(Ci.nsIAbDirectory).getStringValue(aName, aDefaultValue);
    },

    // the base dirName uses a preference, which forces this to be a top level directory. That
    //  does not work for mailing lists
    set dirName(aName) {
        this.cppBase.QueryInterface(Ci.nsIAbDirectory).dirName = aName;
    },
    get dirName()
    {
        return this.cppBase.QueryInterface(Ci.nsIAbDirectory).dirName;
    },

    // nsIAbCollection overrides
    cardForEmailAddress: function _cardForEmailAddress(emailAddress) {
        return null;
    },

    getCardFromProperty: function _getCardFromProperty(aName, aValue, aCaseSensitive) {
        return null;
    },

    // local helper functions
    addCardFromItem: function _addCardFromItem(aItem)
    {
        let card = Cc['@mozilla.org/addressbook/cardproperty;1'].createInstance(Ci.nsIAbCard);
        card.directoryId = this.uuid;
        this.updateCardFromItem(aItem, card);
        return card;
    },

    // Update native item properties from a skink card. Return false if nothing changed,
    //  true if something changed. Note this gets called from modify card, which
    //  gets called routinely during compose to update a frequency count (which we do not
    //  support).
    updatePropertiesFromCard: function _updatePropertiesFromCard(aCard, aProperties, aNotify) {

    },

    // set properties with notifications of changes
    setCardProperty: function _setCardProperty(aCard, aSkinkName, aNewValue)
    {
    },

    updateCardFromItem: function _updateCardFromItem(aItem, card) {
    },

    removeFromAddressMap: function _removeFromAddressMap(email, itemId)
    {
    },

    // returns the card that was added or modified
    updateItem: function _updateItem(aItem)
    {
    },

    updateContact: function _updateContact(aItem)
    {
    },
  
    updateDistList: function _updateDistList(aItem)
    {
        return null;
    },

    // Given a resolution item from ResolveNames, generate an appropriate nativeItem that can be
    //  converted into a card using standard item processing
    itemFromResolution: function _itemFromResolution(resolution) {
    },

    startup: function _startup()
    {
      let observerService = Cc["@mozilla.org/observer-service;1"]
                               .getService(Ci.nsIObserverService);
      observerService.addObserver(this, "quit-application", false);
    },
  
    shutdown: function _shutdown()
    {
      this.jsParent = null;
    },
  
    observe: function _observe(aMessage, aTopic, aData)
    {
      if (aTopic == "quit-application")
      {
        this.shutdown();
      }
      return;
    },

    // EwsAbDirectory implementation
    get folderId() { return this.wrap.getStringValue('folderId', ''); },
    set folderId(aFolderId) { this.wrap.setStringValue('folderId', aFolderId); },
    get distinguishedFolderId() { return this.wrap.getStringValue('distinguishedFolderId', ''); },
    set distinguishedFolderId(aDistinguishedFolderId)
    {
        this.wrap.setStringValue('distinguishedFolderId', aDistinguishedFolderId);
        if (aDistinguishedFolderId == "msgfolderroot")
        this.wrap.mIsGAL = true;
    },

    get serverURI() {
        try {
        if (!this.wrap.mURI || !this.wrap.mURI.length)
            throw("missing address book uri");
        let uriObject = newParsingURI(this.wrap.mURI);
        if (Ci.nsIURIMutator) {
            uriObject = uriObject.mutate().setScheme("exquilla").finalize();
        } else {
            uriObject.scheme = "exquilla";
        }
        return uriObject.prePath;
        } catch(e) {re(e);}},

        loadDirectoryCards: function _loadDirectoryCards(aListener) {

    },

    startSearch: function _startSearch() {

    },

    search: async function _search(aQuery, aListener)
    {
    },

    rebuild: function _rebuild()
    {
    },

    getChildCardsWithListener: function _getChildCardsWithListener(aListener) {
        return new ArrayEnumerator([]);
    },

    deleteCardsWithListener: function _deleteCardsWithListener(aCards, aListener)
    {
    },

    searchGAL: function _searchGAL(aEntry, aListener) {

    },

    get isGAL() {
        return this.wrap.mIsGAL;
    },

    get nativeFolder()
    {
        if (!this.wrap.mNativeFolder)
        {
        if (!this.wrap.mailbox)
            return null;
        let id = this.wrap.distinguishedFolderId;
        if (!id.length)
            id = this.wrap.folderId;
        let nativeFolder = this.wrap.mailbox.getNativeFolder(id);
        //nativeFolder.displayName = this.wrap.dirName;
        this.wrap.mNativeFolder = nativeFolder;
        }
        return this.wrap.mNativeFolder;
    },

    updateDirectory: function _updateDirectory(aListener)
    {
        let updateListener = new UpdateDirectoryListener(this.wrap, aListener);
        callLater( function () {updateListener.onEvent(null, "Begin", null, Cr.NS_OK);});
    },

  // EwsEventListener implementation
  onEvent: function onEvent(aItem, aEvent, aData, result) {
    try {
        if (aEvent == "StopMachine")
        {
          if (this.wrap.gettingNewItems)
          {
            log.debug("StopMachine for gettingNewItems");
            this.wrap.gettingNewItems = false;
            if (this.wrap.getChildCardsListener)
            {
              this.wrap.getChildCardsListener.onEvent(aItem, aEvent, this.wrap.getChildCardsWithListener(null), result);
              this.wrap.getChildCardsListener = null;
            }
            // Something to listener for, since get childCards() is sync.
            Services.obs.notifyObservers(this, "exquilla-gettingNewItems-StopMachine", this.mURI);
          }
          else if (this.wrap.resolvingNames)
          {
            log.debug("StopMachine for resolvingNames");
            this.wrap.resolvingNames = false;
            let resolutions = aData;
            if (!resolutions || !resolutions.length)
            {
              log.debug("resolveNames returned no results");
              return;
            }
            for (let resolution of resolutions)
            {
              if (!(resolution && resolution.PropertyList))
                log.warning("resolution not a property list")
              else
              {
                //log.debug("Resolution #" + i + " PL is\n" + stringPL(resolution));
                // We have to turn the search resolution into a card
                // XXX todo - store in base directory
                let item = this.wrap.itemFromResolution(resolution);
                if (item)
                {
                  this.wrap.updateItem(item);
                  // we cache these in the base GAL as well
                  let jsBaseDirectory = this.wrap.mNoQueryDirectory
                                            .QueryInterface(Ci.msgIOverride)
                                            .jsDelegate
                                            .wrappedJSObject;
                  jsBaseDirectory.updateItem(item);
                }
              }
            }
          }
        }
        else if (aEvent == "ItemChanged")
        {
          if (aData.EwsNativeItem)
            this.wrap.updateItem(aData);
        }
    
      } catch (e) {re(e);}
    },

    // nsIAbDirSearchListener implementation
    onSearchFinished: function _onSearchFinished(aResult, aErrorMsg)
    {
        log.debug("ewsAbDirectoryComponent.onSearchFinished with result " + aResult);
        if (this.wrap.mIsGAL)
        {
        // We'll initiate a remote search for items
        // First get the search entry from the query, which looks like (for "test"):
        // (or(PrimaryEmail,c,test)(DisplayName,c,test)(FirstName,c,test)(LastName,c,test))
        let entries = /\,([^\,\(\)]*)\)/.exec(this.wrap.mQueryString);
        let entry = (entries && entries.length > 1 ? entries[1] : "");
        // start a resolveNames search
        this.wrap.resolvingNames = true;
        let decodedEntry = decodeURIComponent(entry);
        this.wrap.mailbox.resolveNames(decodedEntry, true, this);
        }
    },

    onSearchFoundCard: function _onSearchFoundCard(aCard)
    { try {
        //dl('onSearchFoundCard email ' + aCard.primaryEmail);
        let itemId = aCard.getProperty('itemId', '');
        if (!this.wrap.cards.has(itemId))
        {
            this.wrap.cards.set(itemId, aCard);
            this.wrap.addToAddressMap(aCard.primaryEmail, itemId);
            this.wrap.addToAddressMap(aCard.getProperty('SecondEmail', ''), itemId);
        }
        } catch(e) {re(e);}
    },
}

// Constructor
function EwsAbDirectoryConstructor() {
}

// Constructor prototype (not instance prototype).
EwsAbDirectoryConstructor.prototype = {
  classID: EwsAbDirectory.Properties.classID,
  _xpcom_factory: JSAccountUtils.jaFactory(EwsAbDirectory.Properties, EwsAbDirectory),
}

function EwsAbDirFactory()
{
}

EwsAbDirFactory.prototype = 
{
  classID:          Components.ID("{BDE94D3E-5A66-4027-AADA-13CE8FE762E6}"),
  QueryInterface:   ChromeUtils.generateQI([Ci.nsIAbDirFactory]),

  // nsIAbDirFactory implementation

  //*
  // Get a top level address book directory and sub directories, given some
  //  properties.
  //
  // @param aDirName  Name of the address book
  //
  // @param aURI      URI of the address book
  //
  // @param aPrefName Pref name for the preferences of the address book
  //
  // @return          Enumeration of nsIAbDirectory interfaces
  //
  //nsISimpleEnumerator getDirectories(in AString aDirName, in ACString aURI,
  //                                   in ACString aPrefName);
  getDirectories: function _getDirectories(aDirName, aURI, aPrefName)
  {
    let enumerator = new Utils.ArrayEnumerator([]);
    return enumerator;
  },

  //*
  // Delete a top level address book directory
  // 
  //
  //void deleteDirectory (in nsIAbDirectory directory);
  deleteDirectory: function _deleteDirectory(directory)
  { 
    let prefBranch = Cc["@mozilla.org/preferences-service;1"]
                       .getService(Ci.nsIPrefService)
                       .getBranch(directory.dirPrefId);
    if (prefBranch)
      prefBranch.deleteBranch('');
  },
}

// This object is used to chain event listeners for async calls
function EwsListenerChain(aHead, aTail)
{
  this.head = aHead;
  this.tail = aTail;
}

EwsListenerChain.prototype.onEvent = function _onEvent(aItem, aEvent, aData, result)
{
  if (this.head)
    this.head.onEvent(aItem, aEvent, aData, result);
  if (this.tail)
    this.tail.onEvent(aItem, aEvent, aData, result);
}

function EwsRebuildListener(aDirectory)
{
  this.mState = "INITIAL";
  this.mDirectory = aDirectory;
}

EwsRebuildListener.prototype.onEvent = function EwsRebuildListener_onEvent(aItem, aEvent, aData, result)
{
}


// state management for directory update
function UpdateDirectoryListener(aDirectory, aListener)
{
  this.mDirectory = aDirectory;
  this.mListener = aListener;
  // Don't propogate an error that has been handled
  this.noError = false;
}

UpdateDirectoryListener.prototype.onEvent = function UpdateDirectoryListener_OnEvent(aItem, aEvent, aData, result)
{
}


// update card listener
function UpdateCardListener(aCard)
{
  this.card = aCard;
}

// EwsEventListener implementation
UpdateCardListener.prototype.onEvent =
function UpdateCardListener_onEvent(aItem, aEvent, aData, result)
{
  if (aEvent == "StopMachine")
  {
    this.card.deleteProperty("doingUpdate");
    Services.obs.notifyObservers(this.card, "exquilla-updateCard-StopMachine", null);
  }
}


// new card listener
function NewCardListener(aCard, aItem, aDirectory)
{
  this.card = aCard;
  this.item = aItem;
  this.directory = aDirectory;
}

// EwsEventListener implementation
NewCardListener.prototype.onEvent =
function NewCardListener_onEvent(aItem, aEvent, aData, result)
{
  if (aEvent == "StopMachine")
  {
    let itemId = this.item.itemId;
    this.card.setProperty('itemId', itemId);
    this.directory.cards.set(itemId, this.card);
    this.directory.addToAddressMap(this.card.primaryEmail, itemId);
    this.directory.addToAddressMap(this.card.getProperty('SecondEmail', ''), itemId);
    // TODO: MailServices.ab.notifyDirectoryItemAdded(this.directory.delegator, this.card);
  }
}


function SearchGALListener(aDirectory, aListener)
{
  this.directory = aDirectory;
  this.listener = aListener;
}

// EwsEventListener implementation
SearchGALListener.prototype.onEvent =
function SearchGALListener_onEvent(aItem, aEvent, aData, result)
{ try {
  if (aEvent == "StopMachine")
  {
    log.debug("SearchGALListener_onEvent StopMachine");
    let cards = Cc["@mozilla.org/array;1"].createInstance(Ci.nsIMutableArray);
    let resolutions = aData;
    if (!resolutions || !resolutions.length)
      log.debug("resolveNames returned no results");
    for (let resolution of resolutions || [])
    {
      if (!(resolution && resolution.PropertyList))
        log.warning("resolution not a property list")
      else
      {
        let item = this.directory.itemFromResolution(resolution);
        if (item)
        {
          let card = this.directory.updateItem(item);
          if (card)
            cards.appendElement(card, false);
        }
      }
    }
    log.config("SearchGALListener found " + cards.length + " matching cards");
    if (this.listener)
      this.listener.onEvent(this.directory.delegator, aEvent, cards, result);
  }
} catch(e) {re(e);}}

var NSGetFactory = XPCOMUtils.generateNSGetFactory([EwsAbDirectoryConstructor, EwsAbDirFactory]);
var EXPORTED_SYMBOLS = ["NSGetFactory"];
