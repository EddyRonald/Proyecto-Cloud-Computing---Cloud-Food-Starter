import { connect, StringCodec } from "nats";
let nc; const sc = StringCodec();
export async function connectNats() {
  const servers = process.env.NATS_URL || "nats://nats.nats:4222";
  nc = await connect({ servers });
}
export async function publish(subject, data) {
  await nc.publish(subject, sc.encode(JSON.stringify(data)));
}
