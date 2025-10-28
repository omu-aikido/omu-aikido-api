import { Hono } from "hono";
import { cache } from "hono/cache";
import { getNews } from "./news";
import calendar from "./calendar";
import { wbgt } from "./wbgt";

const app = new Hono();

app.route("/calendar", calendar);

app.get(
  "/news",
  async (c) => {
    const news = await getNews();
    return c.json(news);
  },
  cache({
    cacheName: "newslatter-cache",
    cacheControl: "max-age=3600",
    cacheableStatusCodes: [200, 404, 412],
  }),
);

app.get("/wbgt", async (c) => {
  const kvData = await wbgt(c);
  return c.json(kvData);
});

app.get("*", (c) => {
  return c.notFound();
});

export default app;
