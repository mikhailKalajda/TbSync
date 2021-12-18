
class CalendarBuilder {

    constructor() {
        this.ics = "";
    }

    buildIcs(item, attendeeName,  attendeeEmail) {
        this.append("BEGIN:VCALENDAR");
        this.append("METHOD:REQUEST");
        this.append("PRODID:R7Organizer");
        this.append("VERSION:2.0");
        this.append("BEGIN:VTIMEZONE");
        this.append("TZID:Russian Standard Time");
        this.append("BEGIN:STANDARD");
        this.append("DTSTART:16010101T000000");
        this.append("TZOFFSETFROM:+0300");
        this.append("TZOFFSETTO:+0300");
        this.append("END:STANDARD");
        this.append("BEGIN:DAYLIGHT");
        this.append("DTSTART:16010101T000000");
        this.append("TZOFFSETFROM:+0300");
        this.append("TZOFFSETTO:+0300");
        this.append("END:DAYLIGHT");
        this.append("END:VTIMEZONE");
        this.append("BEGIN:VEVENT");
        if (item.organizer && item.organizer.id)
        {
            let organizerId = cal.email.removeMailTo(item.organizer.id);
            let organizerName = item.organizer.commonName ? item.organizer.commonName : organizerId;

            this.append(`ORGANIZER;CN=${organizerName}:mailto:${organizerId}`);
        }
        this.append(`ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE;CN=${attendeeName ? attendeeName : attendeeEmail}:mailto:${attendeeEmail}`);
        this.append(`DESCRIPTION;LANGUAGE=ru-RU:`);
        this.appendRecurrence(item);
        this.append(`UID:${item.id}`);
        this.append(`SUMMARY;LANGUAGE=ru-RU:`); //${(item.title) ? item.title : ""}
        if (item.startDate)
        {
            this.append(`DTSTART;TZID=Russian Standard Time:${eas.tools.getIcsUtcString(item.startDate)}`);
        }
        if (item.endDate)
        {
            //this.append("DTEND;TZID=Russian Standard Time:20211127T143000");
            this.append(`DTEND;TZID=Russian Standard Time:${eas.tools.getIcsUtcString(item.endDate)}`);

        }
        this.append("CLASS:PUBLIC");
        this.append("DTSTAMP:20211127T103945Z");
        this.append("TRANSP:OPAQUE");
        this.append("STATUS:CONFIRMED");
        this.append("SEQUENCE:0");
        this.append("LOCATION;LANGUAGE=ru-RU:");
        this.append("BEGIN:VALARM");
        this.append("DESCRIPTION:REMINDER");
        this.append("TRIGGER;RELATED=START:-PT15M");
        this.append("ACTION:DISPLAY");
        this.append("END:VALARM");
        this.append("END:VEVENT");
        this.append("END:VCALENDAR");

        return this.ics;
    }

    append(line) {
        if (line.length <= 75)
        {
            this.ics += line + "\r\n";
            return;
        }

        let tail = line.substring(75);
        this.ics += line.substring(0, 75) + "\r\n";

        while (tail.length > 0)
        {
            this.ics += " " + tail.substr(0, 74) + "\r\n";
            tail = tail.substr(74);
        }
    }

    appendRecurrence(item) {
        if (!item.recurrenceInfo) {
            return;
        }

        let startDate = item.startDate;
        let endDate = item.endDate;

        for (let recRule of item.recurrenceInfo.getRecurrenceItems({})) {
            if (recRule.date || recRule.isNegative)
            {
                continue;
            }

            let type = 0;
            let monthDays = recRule.getComponent("BYMONTHDAY", {});
            let weekDays  = recRule.getComponent("BYDAY", {});
            let months    = recRule.getComponent("BYMONTH", {});
            let weeks     = [];

            // Unpack 1MO style days
            for (let i = 0; i < weekDays.length; ++i)
            {
                if (weekDays[i] > 8) {
                    weeks[i] = Math.floor(weekDays[i] / 8);
                    weekDays[i] = weekDays[i] % 8;
                }
                else if (weekDays[i] < -8) {
                    // EAS only supports last week as a special value, treat
                    // all as last week or assume every month has 5 weeks?
                    // Change to last week
                    //weeks[i] = 5;
                    // Assumes 5 weeks per month for week <= -2
                    weeks[i] = 6 - Math.floor(-weekDays[i] / 8);
                    weekDays[i] = -weekDays[i] % 8;
                }

                if (monthDays[0] && monthDays[0] === -1) {
                    weeks = [5];
                    weekDays = [1, 2, 3, 4, 5, 6, 7]; // 127
                    monthDays[0] = null;
                }

                // Type
                if (recRule.type === "WEEKLY") {
                    type = 1;
                    if (!weekDays.length) {
                        weekDays = [startDate.weekday + 1];
                    }
                }
                else if (recRule.type === "MONTHLY" && weeks.length) {
                    type = 3;
                }
                else if (recRule.type === "MONTHLY") {
                    type = 2;
                    if (!monthDays.length) {
                        monthDays = [startDate.day];
                    }
                }
                else if (recRule.type === "YEARLY" && weeks.length) {
                    type = 6;
                }
                else if (recRule.type === "YEARLY") {
                    type = 5;
                    if (!monthDays.length) {
                        monthDays = [startDate.day];
                    }
                    if (!months.length) {
                        months = [startDate.month + 1];
                    }
                }
            }

            this.append(`RRULE:FREQ=${recRule.type};UNTIL=${eas.tools.getIcsUtcString(item.endDate)};INTERVAL=1`);
        }
    }
}

var icsBuilder = {
    build: function (item, attendeeName,  attendeeEmail) {
        let builder = new CalendarBuilder();

        return builder.buildIcs(item, attendeeName,  attendeeEmail);
    }
}
