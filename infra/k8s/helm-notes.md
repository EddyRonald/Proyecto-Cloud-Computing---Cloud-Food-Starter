### NATS
```bash
helm repo add nats https://nats-io.github.io/k8s/helm/charts/
helm repo update
helm install nats nats/nats -n nats --create-namespace   --set nats.image=nats:2.10.18   --set cluster.enabled=false
```
Endpoint dentro del cluster: `nats.nats.svc.cluster.local:4222`

### PostgreSQL (Bitnami)
```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install pg bitnami/postgresql -n data --create-namespace   --set auth.postgresPassword=postgres,auth.database=orders
```
Recupera la contraseña:
```bash
kubectl get secret --namespace data pg-postgresql -o jsonpath="{.data.postgres-password}" | base64 -d
```
Crea un Secret con `DATABASE_URL` si prefieres:
`postgresql://postgres:postgres@pg-postgresql.data.svc.cluster.local:5432/orders`
