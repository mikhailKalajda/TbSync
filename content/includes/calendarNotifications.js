
// noinspection ES6ConvertVarToLetConst used as export
var CalendarNotifications = {
    decycle: function (obj, stack = []) {
        if (!obj || typeof obj !== 'object')
            return obj;

        if (stack.includes(obj))
            return null;

        let s = stack.concat([obj]);

        return () => {
            try {
                return Array.isArray(obj)
                    ? obj.map(x => this.decycle(x, s))
                    : Object.fromEntries(
                        Object.entries(obj)
                            .map(([k, v]) => [k, this.decycle(v, s)]));
            } catch (e) {
                return `error ${e.message}`;
            }
        };
    },

    getServerInfo : function (wbxmlData) {
        const path = "Sync.Collections.Collection.Responses.Add";
        let status = eas.xmltools.getWbxmlDataField(wbxmlData, path + ".Status");

        if (status === "1") {
            let clientId = eas.xmltools.getWbxmlDataField(wbxmlData, path + ".ClientId");
            let serverId = eas.xmltools.getWbxmlDataField(wbxmlData, path + ".ServerId");

            return { clientId: clientId, serverId: serverId };
        }
    },

    sendToAttendee: async function(item, tbItem, attendeeName, attendeeEmail, clientId, syncData)
    {
        let organizer = "mailto:r7user1@ad.r7-demo.ru";

        if (item.organizer) {
            organizer = item.organizer.id;
            //TbSync.dump('sendToAttendee organizer is not set');
            //return;
        }

        let ics = eas.sync.icsBuilder.build(item, attendeeName, attendeeEmail);

        TbSync.dump('ICS=' + ics);

        let mimeContent = `MIME-Version: 1.0
From: ${cal.email.removeMailTo(organizer)}
Subject: ${(item.title) ? item.title : ""}
Thread-Topic: ${(item.title) ? item.title : ""}
To: ${attendeeEmail}
Content-Type: multipart/alternative;
boundary="---Next Part---"
-----Next Part---
Content-Transfer-Encoding: quoted-printable
Content-Type: text/plain; charset="utf-8"
${(item.title) ? item.title : ""}
-----Next Part---
Content-Type: text/calendar; charset="utf-8"; method=REQUEST
Content-Transfer-Encoding: base64

${btoa(ics)}
-----Next Part---`;

        try {
            let wbxml = eas.wbxmltools.createWBXML();
            wbxml.switchpage("ComposeMail");
            wbxml.otag("SendMail");
            wbxml.atag("ClientId", clientId);
            wbxml.singleTag("SaveInSentItems");
            wbxml.btag("Mime", mimeContent);

            let wbxmlbytes = wbxml.getBytes();

            let requestDump = [];

            for (let i = 0; i < wbxmlbytes.length; i++) {
                requestDump.push(wbxmlbytes.charCodeAt(i));
            }

            let dumpStr = eas.wbxmltools.convert2xml(wbxmlbytes);
            TbSync.dump('SendMail request=' + JSON.stringify(wbxml) + ', requestDump=' + JSON.stringify(requestDump) + ', stringDump=' + dumpStr);
            let response = await eas.network.sendRequest(wbxmlbytes, "SendMail", syncData);

            let wbxmlData = eas.network.getDataFromResponse(response);
            TbSync.dump('SendMail response = ' + JSON.stringify(wbxmlData));
        } catch (e) {
            TbSync.dump('SendMail failed ' + e.message);
        }
    },

    sendInvitations: async function (serverInfo, item, tbItem, syncData) {
        let clientIdBase = (new Date()).getTime();
        let countAttendees = {};
        let attendees = item.getAttendees(countAttendees);

        if (countAttendees.value > 0) {
            let i = 1;
            for (let attendee of attendees)
            {
                TbSync.dump('send invitation email to ' + attendee.id);
                await this.sendToAttendee(item, tbItem, attendee.commonName, cal.email.removeMailTo(attendee.id), `${clientIdBase}-${i++}`, syncData);
            }
        }
    }
}
