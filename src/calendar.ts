import { Hono } from "hono";
import { convertIcsCalendar, generateIcsCalendar, IcsCalendar } from "ts-ics";

const app = new Hono();

app.get("/ics", async (c) => {
  try {
    const ics = await getIcs();
    return c.text(ics, 200, { "Content-Type": "text/calendar" });
  } catch {
    return c.text("Internal Server Error", 500);
  }
});

app.get("/json", async (c) => {
  let calendar: {
    id: string;
    title: string;
    start: Date;
    end: Date;
    location: string | undefined;
    description: string | undefined;
  }[];
  try {
    calendar = await getJson();
  } catch {
    return c.text("Internal Server Error", 500);
  }
  return c.json(calendar);
});

export default app;

async function getIcs() {
  const baseURL = "https://calendar.google.com/calendar/ical/";
  const deafult = "new.ocuaikido%40gmail.com/public/basic.ics";

  const targetUrl = `${baseURL}${deafult}`;

  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch target URL: ${response.statusText}`);
  }

  const res = await response.text();
  const parsedData = convertIcsCalendar(undefined, res);
  const events = parsedData.events;
  if (!events) {
    throw new Error("No events found in the ICS data");
  }
  const filteredEvents = events.filter((event) => {
    const startDate = new Date(new Date().setMonth(new Date().getMonth() - 2));
    const endDate = new Date(new Date().setMonth(new Date().getMonth() + 3));
    return (
      new Date(event.start.date) >= startDate &&
      (event.end
        ? new Date(event.end.date) <= endDate
        : new Date(event.start.date) <= endDate)
    );
  });
  const icsCalendar: IcsCalendar = {
    version: "2.0",
    prodId: parsedData.prodId,
    method: parsedData.method,
    timezones: parsedData.timezones,
    events: filteredEvents,
  };

  return generateIcsCalendar(icsCalendar);
}

async function getJson() {
  const baseURL = "https://calendar.google.com/calendar/ical/";
  const deafult = "new.ocuaikido%40gmail.com/public/basic.ics";

  const targetUrl = `${baseURL}${deafult}`;

  const response = await fetch(targetUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch target URL: ${response.statusText}`);
  }

  const res = await response.text();
  const parsedData = convertIcsCalendar(undefined, res);
  const events = parsedData.events;
  if (!events) {
    throw new Error("No events found in the ICS data");
  }
  const filteredEvents = events.filter((event) => {
    const startDate = new Date(new Date().setHours(0, 0, 0, 0));
    const endDate = new Date(new Date().setMonth(new Date().getMonth() + 3));
    return (
      new Date(event.start.date) >= startDate &&
      (event.end
        ? new Date(event.end.date) <= endDate
        : new Date(event.start.date) <= endDate)
    );
  });

  const json = filteredEvents
    .map((event) => ({
      id: event.uid,
      title: event.summary,
      start: event.start.date,
      end: event.end ? event.end.date : event.start.date,
      location: event.location,
      description: event.description,
    }))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  return json;
}
