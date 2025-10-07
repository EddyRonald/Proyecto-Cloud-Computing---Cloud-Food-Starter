import express from "express";
const app = express();
app.get("/healthz", (_, res) => res.json({ ok: true, service: "restaurant-svc" }));
const port = process.env.PORT || 3000;
app.listen(port, () => console.log("restaurant-svc on :" + port));
