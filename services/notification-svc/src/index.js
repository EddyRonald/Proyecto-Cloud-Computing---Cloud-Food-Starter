import express from "express";
import { subscribeAll } from "./nats.js";

const app = express();
app.get("/healthz", (_, res) => res.json({ ok: true }));

subscribeAll((subject, data) => {
  console.log("[notification] event:", subject, data);
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`notification-svc on :${port}`));
