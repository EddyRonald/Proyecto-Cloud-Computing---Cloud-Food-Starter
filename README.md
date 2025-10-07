@"
# 🍔 Cloud Food – Microservicios en Kubernetes

Proyecto del curso **Cloud Computing** que implementa una aplicación distribuida basada en **microservicios** orquestados con **Kubernetes** (Kind).  
Incluye **NATS** para mensajería, **PostgreSQL** como base de datos y **Prometheus + Grafana** para observabilidad.  
El **frontend (React + Vite + Tailwind)** permite crear, pagar y consultar pedidos en una interfaz simple y en español.

---

## 🎯 Objetivo del proyecto

- Practicar el diseño, contenedorización y orquestación de microservicios en un entorno local con **Kubernetes**.
- Implementar **comunicación asíncrona** con NATS, **persistencia** con PostgreSQL y **observabilidad** (métricas + dashboards).
- Entregar un **stack reproducible** que pueda levantarse desde cero en otra PC en pocos pasos.

---

## 🧩 Arquitectura


- **Gateway**: NGINX Ingress Controller expone rutas HTTP del backend y del frontend.
- **Observabilidad**: Prometheus scrapea métricas de los servicios; Grafana muestra dashboards.

---

## 🧱 Estructura del repositorio

cloud-food-starter/
├── infra/
│ └── k8s/
│ ├── kind/ # Config del cluster Kind
│ ├── gateway/ # Ingress (NGINX)
│ ├── monitoring/ # Prometheus + Grafana
│ ├── order-svc/ # manifests (Deployment/Service)
│ ├── payment-svc/
│ ├── notification-svc/
│ └── web/
│
├── services/
│ ├── order-svc/ # código (Node/Express)
│ ├── payment-svc/
│ └── notification-svc/
│
├── web/ # frontend (React + Vite + Tailwind)
│ ├── src/
│ ├── public/
│ └── Dockerfile
│
└── docs/ # notas auxiliares



---

## 🧱 Componentes y endpoints

### 1) `order-svc`
- **Responsable**: crear pedidos y consultarlos.
- **Endpoints**:
  - `POST /orders` → crea pedido (`{ userId, items: [{menuId, qty}] }`)
  - `GET /orders/:id` → consulta estado (`CREATED` o `PAID`)
  - `GET /healthz` → healthcheck
  - `GET /metrics` → métricas Prometheus (incluye `http_requests_total`)
- **ENV**: `PORT` (3000 por defecto), `NATS_URL` (ej. `nats://nats.nats.svc.cluster.local:4222`),  
  `DATABASE_URL` (ej. `postgresql://postgres:postgres@pg-postgresql.data.svc.cluster.local:5432/orders`)

### 2) `payment-svc`
- **Responsable**: confirmar pago (simulado) y publicar evento `order.paid`.
- **Endpoints**:
  - `POST /payments` → `{ orderId, amount, method }`
  - `GET /healthz`, `GET /metrics`
- **ENV**: `PORT`, `NATS_URL`, `DATABASE_URL` (si almacena auditoría)

### 3) `notification-svc`
- **Responsable**: suscribirse a `order.created` y `order.paid` y registrar/emitir notificaciones.
- **Endpoints**: `GET /healthz`, `GET /metrics`
- **ENV**: `PORT`, `NATS_URL`

### 4) `web` (React + Vite + Tailwind)
- Panel en español con 3 paneles: **Crear pedido**, **Pagar**, **Consultar**.
- Muestra gráfico “**Pedidos por minuto**” usando Prometheus.
- **ENV opcional**: `VITE_API_BASE` si quieres apuntar a otro host distinto del Ingress.

---

## 🧰 Requisitos previos

- **Docker Desktop** (con Kubernetes habilitado o solo Docker si usarás Kind)
- **kubectl**
- **kind**
- **Node.js 18+** (para construir frontend/backend)
- **Helm** (si deseas personalizar el stack de monitoring; no obligatorio para los manifests incluidos)

*Verificadores (opcional): `node -v`, `kubectl version --client`, `kind version`, `helm version`.*

---

## 🏗️ Despliegue local paso a paso

> **Nota**: Los comandos asumen Windows PowerShell, pero son equivalentes en macOS/Linux.

### 1) Crear cluster Kind
```bash
kind create cluster --name cloud-food --config infra/k8s/kind/config.yaml
# Si no tienes el archivo de config, basta con:
# kind create cluster --name cloud-food


2) Construir imágenes Docker (desde la raíz del repo)

docker build -t order-svc:0.1.0          services/order-svc
docker build -t payment-svc:0.1.0        services/payment-svc
docker build -t notification-svc:0.1.0   services/notification-svc
docker build -t cloud-food-web:0.1.0     web

3) Cargar imágenes en Kind

kind load docker-image order-svc:0.1.0 --name cloud-food
kind load docker-image payment-svc:0.1.0 --name cloud-food
kind load docker-image notification-svc:0.1.0 --name cloud-food
kind load docker-image cloud-food-web:0.1.0 --name cloud-food

4) Aplicar manifests de Kubernetes

kubectl apply -f infra/k8s/order-svc/deploy.yaml
kubectl apply -f infra/k8s/payment-svc/deploy.yaml
kubectl apply -f infra/k8s/notification-svc/deploy.yaml
kubectl apply -f infra/k8s/web/deploy.yaml
kubectl apply -f infra/k8s/gateway/ingress.yaml
kubectl apply -f infra/k8s/monitoring/         # si está en una carpeta con varios archivos

5) Verificar pods

kubectl get pods -A

6) Exponer el Ingress (NGINX)

kubectl -n ingress-nginx port-forward svc/ingress-nginx-controller 8080:80

Frontend: http://localhost:8080
API routes (gateway): http://localhost:8080/orders, http://localhost:8080/payments …

📊 Monitoreo y métricas

Prometheus

kubectl -n monitoring port-forward svc/mon-kube-prometheus-stack-prometheus 9090:9090

UI: http://localhost:9090

Consulta ejemplo (PromQL):
sum(rate(http_requests_total{app="order-svc",method="POST",path="/orders"}[1m]))

Grafana

kubectl -n monitoring port-forward svc/mon-grafana 3000:80

Panel: http://localhost:3000
Usuario: admin | Contraseña: prom-operator
Dashboards sugeridos: Kubernetes / Compute Resources (Cluster/Namespace/Pod)

🧪 Probar desde la línea de comandos

Crear pedido

$body = @{ userId = "u1"; items = @(@{ menuId = "m1"; qty = 2 }) } | ConvertTo-Json
Invoke-WebRequest -Method POST -Uri http://localhost:8080/orders -ContentType 'application/json' -Body $body

Pagar pedido (ejemplo con orderId=1)

$pay = @{ orderId = 1; amount = 25.5; method = "CARD" } | ConvertTo-Json
Invoke-WebRequest -Method POST -Uri http://localhost:8080/payments -ContentType 'application/json' -Body $pay

Consultar pedido

Invoke-WebRequest -Method GET -Uri http://localhost:8080/orders/1

🔄 Actualizar una imagen (redeploy)

# 1) reconstruir con nuevo tag
docker build -t order-svc:0.1.1 services/order-svc

# 2) cargar la imagen en kind
kind load docker-image order-svc:0.1.1 --name cloud-food

# 3) actualizar el deployment
kubectl set image deploy/order-svc order=order-svc:0.1.1

# 4) vigilar rollout
kubectl rollout status deploy/order-svc

👨‍💻 Autor
Eddy Ronald Choque Condori
Mauricio Carazas Segovia
Proyecto: Cloud Food – Microservicios en Kubernetes
Curso: Cloud Computing – 2025
"@ | Out-File -Encoding utf8 README.md