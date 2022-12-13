const EXPORTED_SYMBOLS = ["EwsFreeBusy"];

var { XPCOMUtils } = ChromeUtils.import("resource://gre/modules/XPCOMUtils.jsm");
var { Services } = ChromeUtils.import("resource://gre/modules/Services.jsm");
var { TbSync } = ChromeUtils.import("chrome://tbsync/content/tbsync.jsm");
var { MailServices } = ChromeUtils.import("resource:///modules/MailServices.jsm");

ChromeUtils.defineModuleGetter(this, "Utils", "resource://tbsync/ewsUtils.jsm");

ChromeUtils.defineModuleGetter(this, "EwsNativeService",
    "resource://tbsync/EwsNativeService.jsm");

ChromeUtils.defineModuleGetter(this, "PromiseUtils",
    "resource://tbsync/PromiseUtils.jsm");

var { NetUtil } = ChromeUtils.import("resource://gre/modules/NetUtil.jsm");
ChromeUtils.defineModuleGetter(this, "StringArray",
    "resource://tbsync/StringArray.jsm");
ChromeUtils.defineModuleGetter(this, "PropertyList",
    "resource://tbsync/PropertyList.jsm");
ChromeUtils.defineModuleGetter(this, "EwsSoapRequest",
    "resource://tbsync/EwsSoapRequest.jsm");
ChromeUtils.defineModuleGetter(this, "EWStoPL",
    "resource://tbsync/EWStoPL.js");

//var { cal } = ChromeUtils.import("resource://calendar/modules/calUtils.jsm");

var calDateTime = Ci.calDateTime;
var calDuration = Ci.calDuration;
var calIcalComponent = Ci.calIcalComponent;
var calIcalProperty = Ci.calICSService;
var calPeriod = Ci.calPeriod;
var calRecurrenceRule = Ci.calRecurrenceRule;

function EwsFreeBusy() {
    TbSync.dump('EwsFreeBusy ctor');
    TbSync.dump('TbSync.lightning =' + TbSync.lightning);

    EwsFreeBusy.prototype.__proto__ = TbSync.lightning.cal.provider.BaseClass.prototype;
    EwsFreeBusy.prototype.QueryInterface = TbSync.lightning.cal.generateQI(calDavCalendarInterfaces);
    EwsFreeBusy.prototype.classInfo = TbSync.lightning.cal.generateCI({
        classID: calDavCalendarClassID,
        contractID: "@mozilla.org/calendar/calendar;1?type=ewsfreebusy",
        classDescription: "Calendar Ews FreeBuse back-end",
        interfaces: calDavCalendarInterfaces,
    });

    this.id = 1;
}

var calDavCalendarClassID = Components.ID("{9ed6a91a-dcd3-4be5-a2a8-596ac82ed9eb}");
var calDavCalendarInterfaces = [
    Ci.calIFreeBusyProvider,
];

var requestId = 1;

function ConvertEwsDate(aDateStr, aBaseDate) {
    let parsedDate = new Date(aDateStr);

    TbSync.dump("ConvertEwsDate, aDateStr=" + aDateStr +
        ', parsedDate=' + parsedDate +
        ', parsedDate.hour=' + parsedDate.getHours() +
        ', parsedDate.minute=' + parsedDate.getMinutes());

    if (parsedDate) {
        let clonedDate = aBaseDate.clone();

        clonedDate.year = parsedDate.getFullYear();
        clonedDate.month = parsedDate.getMonth() + 1;
        clonedDate.day = parsedDate.getDate();
        clonedDate.hour = parsedDate.getHours();
        clonedDate.minute = parsedDate.getMinutes();

        const magicHours = 11; // I don't know why we receive time in 11 hours shift form Exchange server...

        clonedDate.hour += magicHours;

        return { isParsed: true, date: clonedDate }
    }

    return { isParsed: false }
}

function twoDigit(aNum) {
    if (aNum < 10) {
        return `0${aNum}`;
    }

    return `${aNum}`;
}

EwsFreeBusy.prototype = {
    classID: calDavCalendarClassID,


    /**
     * Gets free/busy intervals.
     * Results are notified to the passed listener interface.
     *
     * @param aCalId calid or MAILTO:rfc822addr
     * @param aRangeStart start time of free-busy search
     * @param aRangeEnd end time of free-busy search
     * @param aBusyTypes what free-busy intervals should be returned
     * @param aListener called with an array of calIFreeBusyInterval objects
     * @return optional operation handle to track the operation
     */
    getFreeBusyIntervals: function(aCalId, aRangeStart, aRangeEnd, aBusyTypes, aListener) {
        TbSync.dump("getFreeBusyIntervals running, aCalId=" + aCalId);

        let id = requestId++;

        try {
            let nativeService = new EwsNativeService();
            let mailbox = null;

            let rootBranch = Cc["@mozilla.org/preferences-service;1"].getService(Ci.nsIPrefBranch);
            let loadedAccounts = rootBranch.getCharPref("mail.accountmanager.accounts").split(",");

            for (let accountKey of loadedAccounts)
            {
                let account = MailServices.accounts.getAccount(accountKey);

                if (account) {
                    // Sometimes servers don't load even when they should. So double check for loaded server
                    // First check preferences
                    Utils.safeGetJS(account.incomingServer, "EwsIncomingServer");
                }
            }

            for (let server of /* COMPAT for TB 68 */Utils.toArray(MailServices.accounts.allServers, Ci.nsIMsgIncomingServer))
            {
                if (server.type === "exquilla") {
                    TbSync.dump("getFreeBusyIntervals server type=" + server.type +
                        ", prettyName=" + server.prettyName +
                        ", realUsername=" + server.realUsername +
                        ", realHostName=" + server.realHostName +
                        ", serverURI=" + server.serverURI +
                        ", email=" + server.email +
                        ", class=" + server.constructor.name);

                    let incomingServer = MailServices.accounts.getIncomingServer(server.key);

                    mailbox = incomingServer.nativeMailbox;

                    if (!mailbox ) {
                        mailbox = nativeService.getNativeMailbox(server.serverURI);

                        if (mailbox) {
                            if (!mailbox.ewsURL) {
                                // TODO: create uri with schema
                                mailbox.ewsURL = `https://${server.realHostName}/EWS/Exchange.asmx`; //#asis
                            }
                            if (!mailbox.email) {
                                mailbox.email = server.email;
                            }
                            if (!mailbox.username) {
                                mailbox.username = server.realUsername;
                            }
                            if (!mailbox.password) {
                                mailbox.password = server.password;
                            }

                        }
                    }
                }
            }

            if (!mailbox) {
                TbSync.dump("getFreeBusyIntervals no mailbox, exited");
                return;
            }

            TbSync.dump("getFreeBusyIntervals ran getNativeMailbox, mailbox.ewsURL=" + mailbox.ewsURL + '/' + mailbox.serverURI);

            let listener = new PromiseUtils.MachineListener();
            let soapResponse = new PromiseUtils.SoapResponse(listener);
            let request = new EwsSoapRequest();

            request.mailbox = mailbox;

            (async () => {
                TbSync.dump("getFreeBusyIntervals ran getUserAvailabilityRequest async");

                let email = aCalId.replace('mailto:', '');
                let startDateStr = `${aRangeStart.year}-${twoDigit(aRangeStart.month)}-${twoDigit(aRangeStart.day)}T${twoDigit(aRangeStart.hour)}:${twoDigit(aRangeStart.minute)}:${twoDigit(aRangeStart.second)}`;
                let endDateStr = `${aRangeEnd.year}-${twoDigit(aRangeEnd.month)}-${twoDigit(aRangeEnd.day)}T${twoDigit(aRangeEnd.hour)}:${twoDigit(aRangeEnd.minute)}:${twoDigit(aRangeEnd.second)}`;

                TbSync.dump(`email=${email}, startDateStr=${startDateStr}, endDateStr=${endDateStr}`);

                request.getUserAvailabilityRequest(soapResponse, email, startDateStr, endDateStr);

                request.invoke();

                let result = await soapResponse.promise;
                TbSync.dump("getFreeBusyIntervals getUserAvailabilityRequest async resulted");

                if (result.status !== Cr.NS_OK) {
                    TbSync.dump("getFreeBusyIntervals failed status = " + result.status);
                    aListener.onResult({ id: result.request.id, isPending: false }, []);
                    return;
                }

                response = result.request.result;
                TbSync.dump(JSON.stringify(response));

                let responseCode = EWStoPL.getValueByPath(response, ["ResponseMessage", "ResponseCode", "ResponseClass"]);

                let freeBusyResult = [];

                if (responseCode !== "NoError")
                {
                    TbSync.dump("getFreeBusyIntervals error code " + responseCode);
                    aListener.onResult({ id: result.request.id, isPending: false }, freeBusyResult);
                    return;
                }

                let timeZoneBias = EWStoPL.getValueByPath(response, ["FreeBusyView", "WorkingHours", "TimeZone", "Bias"]);

                TbSync.dump('getFreeBusyIntervals bias=' + timeZoneBias);
                let values = EWStoPL.getValuesByPath(response, ["FreeBusyView", "CalendarEventArray", "CalendarEvent"]);

                let baseDate = TbSync.lightning.cal.createDateTime();

                if (values && values.length > 0 && values[0].length > 0) {
                    let events =values[0][0];

                    for (let i = 0; i < events.length; i++) {
                        let freeBusy = values[0][0][i];

                        let startTime = EWStoPL.getValueByPath(freeBusy, ["StartTime"]);
                        let endTime = EWStoPL.getValueByPath(freeBusy, ["EndTime"]);
                        let busyType = EWStoPL.getValueByPath(freeBusy, ["BusyType"]);

                        let start = ConvertEwsDate(startTime, baseDate);
                        let end = ConvertEwsDate(endTime, baseDate);

                        if (start.isParsed && end.isParsed) {

                            freeBusyResult.push({
                                freeBusyType: 2, //busyType === "Busy" ? 2 : 1,
                                interval: {
                                    start: {
                                        getInTimezone: function (timezone) {
                                            return start.date;
                                        }
                                    },
                                    end: {
                                        getInTimezone: function (timezone) {
                                            return end.date;
                                        }
                                    }
                                }
                            });
                        } else {
                            TbSync.dump('Invalid datetime format startTime=' + startTime + 'or endTime=' + endTime);
                        }
                    }
                }

                let dumpStr = "";
                for (let i = 0; i < freeBusyResult.length; i++) {
                    let start = freeBusyResult[i].interval.start.getInTimezone('00');
                    let end = freeBusyResult[i].interval.end.getInTimezone('00');

                    dumpStr += `{ start: { ${start.year}-${start.month}-${start.day} ${start.hour}-${start.minute}  }, end: { ${end.year}-${end.month}-${end.day} ${end.hour}-${end.minute} }}, `;
                }

                TbSync.dump(dumpStr);

                aListener.onResult({ id: result.request.id, isPending: false }, freeBusyResult);
                //return (result);
            })();

            var response = {};

            // soapResponse.promise.then(function(result) {
            //     TbSync.dump("getFreeBusyIntervals resulted here");
            //
            //     if (result.status !== Cr.NS_OK) {
            //         TbSync.dump("getFreeBusyIntervals failed status = " + result.status);
            //         aListener.onResult({ id: result.request.id, isPending: false }, []);
            //         return;
            //     }
            //
            //     response = result.request.result;
            //     TbSync.dump(JSON.stringify(response));
            //
            //     let responseCode = EWStoPL.getValueByPath(response, ["ResponseMessage", "ResponseCode", "ResponseClass"]);
            //
            //     let freeBusyResult = [];
            //
            //     if (responseCode !== "NoError")
            //     {
            //         TbSync.dump("getFreeBusyIntervals error code " + responseCode);
            //         aListener.onResult({ id: result.request.id, isPending: false }, freeBusyResult);
            //         return;
            //     }
            //
            //     let values = EWStoPL.getValuesByPath(response, ["FreeBusyView", "CalendarEventArray", "CalendarEvent"]);
            //
            //     if (values && values.length > 0 && values[0].length > 0) {
            //         let events =values[0][0];
            //         let baseDate = TbSync.lightning.cal.createDateTime();
            //
            //         for (let i = 0; i < events.length; i++) {
            //             let freeBusy = values[0][0][i];
            //
            //             let startTime = Date.parse(EWStoPL.getValueByPath(freeBusy, ["StartTime"]));
            //             let endTime = Date.parse(EWStoPL.getValueByPath(freeBusy, ["EndTime"]));
            //             let busyType = EWStoPL.getValueByPath(freeBusy, ["BusyType"]);
            //
            //             let start = baseDate.clone();
            //             start.year = startTime.getFullYear();
            //             start.month = startTime.getMonth();
            //             start.day = startTime.getDay();
            //             start.hour = startTime.getHours();
            //             start.minute = startTime.getMinutes();
            //
            //             let end = baseDate.clone();
            //             end.year = endTime.getFullYear();
            //             end.month = endTime.getMonth();
            //             end.day = endTime.getDay();
            //             end.hour = endTime.getHours();
            //             end.minute = endTime.getMinutes();
            //
            //             freeBusyResult.push({
            //                 freeBusyType: busyType === "Busy" ? 2 : 1,
            //                 interval: {
            //                     start: {
            //                         getInTimezone: function (timezone) {
            //                             return start;
            //                         }
            //                     },
            //                     end: {
            //                         getInTimezone: function (timezone) {
            //                             return end;
            //                         }
            //                     }
            //                 }
            //             });
            //         }
            //     }
            //
            //     aListener.onResult({ id: result.request.id, isPending: false }, freeBusyResult);
            // });

            return { id, isPending: true };
        } catch (e) {
            TbSync.dump("getFreeBusyIntervals failed " + e.message);
            return { id, isPending: false };
        }
    },
}
