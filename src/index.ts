import { Hono } from "hono";
import { cors } from "hono/cors";
import { cache } from "hono/cache";
import { getNews } from "./news";
import calendar from "./calendar";
// import { wbgt } from "./wbgt";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: [
      "https://omu-aikido.com",
      "https://preview.omu-aikido-page.pages.dev",
      "http://localhost:4321",
      "http://localhost:8788",
    ],
    maxAge: 600,
    allowMethods: ["GET"],
  }),
  cache({
    cacheName: "omu-aikido-api-cache",
    cacheControl: "max-age=600, s-maxage=1200, private, must-revalidate",
    cacheableStatusCodes: [200, 404, 412],
  }),
);

// Mount calendar sub-app
app.route("/calendar", calendar);

// News endpoint with caching
app.get("/news", async (c) => {
  try {
    const news = await getNews();
    return c.json(news);
  } catch (err) {
    console.error("Error fetching news:", err);
    return c.json({ error: "Failed to fetch news" }, 500);
  }
});

// // WBGT endpoint
// app.get("/wbgt", async (c) => {
//   try {
//     const kvData = await wbgt(c);
//     return c.json(kvData);
//   } catch (err) {
//     console.error("Error fetching WBGT data:", err);
//     return c.json({ error: "Failed to fetch WBGT data" }, 500);
//   }
// });

// Fallback for unknown routes
app.get("*", (c) => c.notFound());

export default app;
