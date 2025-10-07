import { connect, StringCodec } from "nats";

export async function subscribeAll(handler) {
  const sc = StringCodec();
  const nc = await connect({ servers: process.env.NATS_URL || "nats://nats.nats:4222" });
  const sub = nc.subscribe("order.*");
  (async () => {
    for await (const m of sub) {
      const data = JSON.parse(sc.decode(m.data));
      handler(m.subject, data);
    }
  })();
}
