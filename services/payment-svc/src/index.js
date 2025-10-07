import express from "express";
import { connectNats, publish } from "./nats.js";
import { db } from "./pg.js";
import prom from "prom-client";


const registry = new prom.Registry();
prom.collectDefaultMetrics({ register: registry });

const app = express();
app.use(express.json());

app.get("/healthz", (_,res)=>res.json({ok:true}));



app.post("/payments", async (req,res)=>{
  const { orderId, amount=0, method="CARD" } = req.body || {};
  try {
    await db.query("CREATE TABLE IF NOT EXISTS orders (id SERIAL PRIMARY KEY, user_id TEXT, status TEXT)");
    await db.query("UPDATE orders SET status='PAID' WHERE id=$1", [orderId]);
    await publish("order.paid", { orderId, paidAt: new Date().toISOString(), amount, method });
    res.json({ status: "APPROVED" });
  } catch (e) {
    console.error(e); res.status(500).json({error:"payment failed"});
  }
});


app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", registry.contentType);
  res.end(await registry.metrics());
});


const port = process.env.PORT || 3000;
const start = async ()=>{
  await connectNats();
  await db.connect();
  app.listen(port, ()=>console.log(`payment-svc on :${port}`));
};
start();
