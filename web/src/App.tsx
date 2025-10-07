import * as React from "react"

// ======== Config ========
const API_BASE = import.meta.env.VITE_API_BASE || "" // usa proxy o ingress
const PEN = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  maximumFractionDigits: 2,
})

// ======== Utils ========
const storage = {
  get<T>(k: string, fallback: T) {
    try {
      const raw = localStorage.getItem(k)
      return raw ? (JSON.parse(raw) as T) : fallback
    } catch {
      return fallback
    }
  },
  set(k: string, v: any) {
    localStorage.setItem(k, JSON.stringify(v))
  },
}

// ======== Tipos ========
type CreateOrderResp = { orderId: string; status: "CREATED" | string }
type PayResp = { status: "APPROVED" | string }
type OrderInfo = { id: number; userId?: string; status: string }

type OrderHistoryItem = { id: number; userId: string; createdAt: string; total: number }
type Pt = { t: number; v: number }

// ======== Componentes UI ========
function Card(props: { title: string; subtitle?: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white/90 p-5 shadow-sm hover:shadow-md transition">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900">{props.title}</h3>
        {props.subtitle ? <p className="text-sm text-zinc-500">{props.subtitle}</p> : null}
      </div>
      <div className="space-y-4">{props.children}</div>
      {props.footer ? <div className="mt-4 pt-4 border-t border-zinc-200">{props.footer}</div> : null}
    </div>
  )
}

function Field(props: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-sm font-medium text-zinc-700">{props.label}</div>
      {props.children}
    </label>
  )
}

function Btn({
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { className?: string }) {
  return (
    <button
      {...rest}
      className={
        "inline-flex items-center justify-center rounded-xl px-4 py-2 font-medium shadow-sm transition active:scale-[.98] bg-zinc-900 text-white hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-400/40 disabled:opacity-40 disabled:cursor-not-allowed " +
        (className ?? "")
      }
    />
  )
}

function Toast({ kind = "ok", children }: { kind?: "ok" | "warn" | "err"; children: React.ReactNode }) {
  const color =
    kind === "ok" ? "bg-emerald-100 text-emerald-800" :
    kind === "warn" ? "bg-amber-100 text-amber-900" :
    "bg-red-100 text-red-800"
  return <div className={"inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm " + color}>{children}</div>
}

function MiniLine({ data, height = 80 }: { data: Pt[]; height?: number }) {
  const w = 400
  const max = Math.max(1, ...data.map(d => d.v))
  const path = data.map((d, i) => {
    const x = (i / Math.max(1, data.length - 1)) * w
    const y = height - (d.v / max) * height
    return `${i ? "L" : "M"}${x},${y}`
  }).join(" ")
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${height}`} className="text-emerald-500">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}

// =====================================================

export default function App() {
  // -------- Login simulado --------
  const [userId, setUserId] = React.useState<string>(() => storage.get("cf_userId", "u1"))
  React.useEffect(() => storage.set("cf_userId", userId), [userId])

  // -------- Crear pedido --------
  const [user, setUser] = React.useState<string>(userId)
  React.useEffect(() => setUser(userId), [userId])

  const [menuId, setMenuId] = React.useState<string>("m1")
  const [qty, setQty] = React.useState<number>(1)
  const [created, setCreated] = React.useState<{ id: number } | null>(null)

  // -------- Pagar --------
  const [orderIdToPay, setOrderIdToPay] = React.useState<number>(1)
  const [amount, setAmount] = React.useState<number>(25.5)
  const [paid, setPaid] = React.useState<PayResp | null>(null)

  // -------- Consultar --------
  const [orderIdQuery, setOrderIdQuery] = React.useState<number>(1)
  const [orderInfo, setOrderInfo] = React.useState<OrderInfo | null>(null)

  // -------- Historial --------
  const [history, setHistory] = React.useState<OrderHistoryItem[]>(
    () => storage.get("cf_history", [])
  )
  React.useEffect(() => storage.set("cf_history", history), [history])

  // -------- Gráfico Prometheus --------
  const [series, setSeries] = React.useState<Pt[]>([])
  async function fetchProm() {
    try {
      const q = 'sum(rate(http_request_duration_seconds_count{method="post",path="/orders"}[1m]))'
      const r = await fetch(`/prom/api/v1/query?query=${encodeURIComponent(q)}`)
      const j = await r.json()
      const v = Number(j?.data?.result?.[0]?.value?.[1] ?? 0)
      setSeries(s => [...s.slice(-59), { t: Date.now(), v }])
    } catch {}
  }
  React.useEffect(() => {
    fetchProm()
    const id = setInterval(fetchProm, 5000)
    return () => clearInterval(id)
  }, [])

  // -------- Acciones --------
  async function createOrder() {
    const r = await fetch(API_BASE + "/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: user, items: [{ menuId, qty }] }),
    })
    if (!r.ok) throw new Error("Error al crear pedido")
    const j = (await r.json()) as CreateOrderResp
    const idNum = Number(j.orderId)
    setCreated({ id: idNum })
    setOrderIdToPay(idNum)
    setOrderIdQuery(idNum)
    setHistory(h => [
      { id: idNum, userId: user, total: amount, createdAt: new Date().toISOString() },
      ...h,
    ])
  }

  async function payOrder() {
    const r = await fetch(API_BASE + "/payments", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderId: orderIdToPay, amount, method: "CARD" }),
    })
    if (!r.ok) throw new Error("Error al pagar")
    const j = (await r.json()) as PayResp
    setPaid(j)
  }

  async function fetchOrder() {
    const r = await fetch(API_BASE + `/orders/${orderIdQuery}`)
    if (!r.ok) throw new Error("Error al consultar pedido")
    const j = (await r.json()) as OrderInfo
    setOrderInfo(j)
  }

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-zinc-200">
        <div className="mx-auto max-w-6xl px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-xl bg-emerald-600 text-white grid place-items-center font-semibold">CF</div>
            <div>
              <div className="font-semibold">Cloud Food – Panel</div>
              <p className="text-xs text-zinc-500">Backend en {API_BASE || "http://localhost:8080"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-zinc-500 hidden sm:inline">Usuario:</span>
            <input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              className="rounded-xl border px-3 py-1.5 text-sm"
              placeholder="u1"
            />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Fila principal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Crear pedido */}
          <Card title="Crear pedido" subtitle="Genera un nuevo pedido y obtén su ID">
            <Field label="Usuario (userId)">
              <input value={user} onChange={(e) => setUser(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
            </Field>
            <Field label="Artículo (menuId)">
              <input value={menuId} onChange={(e) => setMenuId(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
            </Field>
            <Field label="Cantidad">
              <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2" />
            </Field>
            <Btn onClick={createOrder}>Crear pedido</Btn>
            {created && <Toast>Pedido creado: #{created.id}</Toast>}
          </Card>

          {/* Pagar */}
          <Card title="Pagar" subtitle="Aprueba el pago del pedido">
            <Field label="ID de pedido">
              <input type="number" value={orderIdToPay} onChange={(e) => setOrderIdToPay(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2" />
            </Field>
            <Field label="Monto (S/)">
              <input type="number" step="0.1" value={amount} onChange={(e) => setAmount(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2" />
            </Field>
            <Btn onClick={payOrder}>Pagar</Btn>
            {paid && <Toast kind="ok">Pago {paid.status}</Toast>}
          </Card>

          {/* Consultar */}
          <Card title="Consultar pedido" subtitle="Busca por ID y revisa el estado">
            <Field label="ID de pedido">
              <input type="number" value={orderIdQuery} onChange={(e) => setOrderIdQuery(Number(e.target.value))} className="w-full rounded-xl border px-3 py-2" />
            </Field>
            <Btn onClick={fetchOrder}>Consultar</Btn>
            {orderInfo ? (
              <div className="mt-2 text-sm">
                <div>ID: {orderInfo.id}</div>
                <div>Estado: {orderInfo.status}</div>
                <div>Usuario: {orderInfo.userId ?? "-"}</div>
              </div>
            ) : <div className="text-zinc-400">Sin resultados</div>}
          </Card>
        </div>

        {/* Gráfico Prometheus */}
        <Card title="Pedidos por minuto" subtitle="Prometheus: rate(POST /orders [1m])">
          <MiniLine data={series} height={90} />
        </Card>

        {/* Historial */}
        <Card title="Historial de pedidos" subtitle="Guardado localmente por usuario">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-zinc-500"><th>ID</th><th>Usuario</th><th>Fecha</th><th>Monto</th></tr></thead>
              <tbody>
                {history.filter(x => x.userId === userId).map(x => (
                  <tr key={x.id} className="border-t">
                    <td>{x.id}</td>
                    <td>{x.userId}</td>
                    <td>{new Date(x.createdAt).toLocaleString()}</td>
                    <td>{PEN.format(x.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Métricas Grafana */}
        <Card title="Métricas del clúster" subtitle="Visualiza el monitoreo del sistema en Grafana">
          <p className="text-sm text-zinc-600">
            Puedes abrir Grafana en: <a href="http://localhost:3000" target="_blank" className="underline text-emerald-600">http://localhost:3000</a>
          </p>
          <p className="text-xs text-zinc-500 mt-1">Ejecuta en terminal: <code>kubectl -n monitor port-forward svc/mon-grafana 3000:80</code></p>
          <iframe
            src="http://localhost:3000/d/kubernetes-compute-resources-pod/kubernetes-compute-resources-pod?orgId=1&from=now-1h&to=now"
            className="w-full h-[380px] rounded-xl border mt-3"
          />
        </Card>

        <footer className="text-center text-xs text-zinc-500 pt-4">
          © 2025 Cloud Food • Demo en Kubernetes • NATS + Postgres • Prometheus + Grafana
        </footer>
      </main>
    </div>
  )
}

