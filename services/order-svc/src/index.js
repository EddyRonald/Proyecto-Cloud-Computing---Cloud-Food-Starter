import express from "express";
import prom from "prom-client";
import { connectNats, publish } from "./nats.js";
import { db } from "./pg.js";

const app = express();
app.use(express.json());

// Metrics
const registry = new prom.Registry();
register.setDefaultLabels({ app: 'order-svc' });  
client.collectDefaultMetrics({ register });
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});


const httpRequests = new client.Counter({
  name: 'http_requests_total',
  help: 'Total de peticiones HTTP',
  labelNames: ['method', 'path'],
});
register.registerMetric(httpRequests);


app.use((req, _res, next) => {
  const path = req.route?.path || req.path;
  httpRequests.inc({ method: req.method, path });
  next();
});

app.get('/metrics', async (_req, res) => {
  res.setHeader('Content-Type', register.contentType);
  res.end(await register.metrics());
})


prom.collectDefaultMetrics({ register: registry });
const httpReqDur = new prom.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP request durations",
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5]
});
registry.registerMetric(httpReqDur);

app.get("/healthz", (_, res) => res.json({ ok: true }));

app.post("/orders", async (req, res) => {
  const start = Date.now();
  try {
    const { items = [], userId = "u1" } = req.body || {};
    await db.query("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_id TEXT, status TEXT)");
    const result = await db.query(
      "INSERT INTO orders(user_id,status) VALUES($1,$2) RETURNING id,status",
      [userId, "CREATED"]
    );
    const order = result.rows[0];
    await publish("order.created", {
      orderId: String(order.id), userId, items, createdAt: new Date().toISOString()
    });
    res.status(201).json({ orderId: String(order.id), status: order.status });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "failed" });
  } finally {
    httpReqDur.observe((Date.now() - start) / 1000);
  }
});

app.get("/orders/:id", async (req, res) => {
  await db.query("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_id TEXT, status TEXT)");
  const result = await db.query("SELECT id, status FROM orders WHERE id=$1", [req.params.id]);
  res.json(result.rows[0] ?? {});
});

const port = process.env.PORT || 3000;
const start = async () => {
  await connectNats();
  await db.connect();
  app.listen(port, () => console.log(`order-svc listening on :${port}`));
};
start().catch(err => {
  console.error("failed to start", err);
  process.exit(1);
});
