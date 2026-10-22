# Deploy HES backend to Azure Container Apps (low cost)

Expected cost: **$0–3/month**. The MongoDB Atlas database is **not touched or moved**: the new backend connects to the same database with the same data.

Do not run `npm run seed` or anything in `scripts/` against production.

---

## 0. Before you start
- Rotate your secrets first (Railway breach): new **MongoDB Atlas password** and a new **JWT_SECRET** (24+ characters).
  Changing JWT_SECRET only logs everyone out once. No data is affected.
- MongoDB Atlas → Network Access: keep `0.0.0.0/0`. Container Apps has no fixed outbound IP on this plan.
- Install the Azure CLI, then run all commands in **PowerShell**.

## 1. Push these files to GitHub
New files only: `Dockerfile`, `.dockerignore`, `.github/workflows/deploy-azure.yml`, `AZURE_DEPLOY.md`.

```powershell
cd C:\Users\AbdulRehman\Desktop\mkbw\MKBW_APP\backend
git add Dockerfile .dockerignore .github AZURE_DEPLOY.md
git commit -m "Add Azure Container Apps deployment"
git push newgh main
```
GitHub → repo → **Actions**. The "build" job should go green and the "deploy" job will be **skipped**, which is expected for now.
The image is now at `ghcr.io/techsquare1/hes-backend:latest`. It is private, and it contains no `.env` or secrets.

## 2. Create a GitHub token so Azure can pull the image
GitHub (TechSquare1) → Settings → Developer settings → Tokens (classic) → scope **`read:packages`** only. Copy it.

## 3. Create the Azure resources (one time)
Use a region close to your Atlas cluster. If you're not sure, `centralindia` is fine.

```powershell
az login
az extension add --name containerapp --upgrade
az provider register -n Microsoft.App --wait
az provider register -n Microsoft.OperationalInsights --wait

$RG   = "hes-rg"
$LOC  = "centralindia"
$ENV  = "hes-env"
$APP  = "hes-backend"
$SA   = "hesuploads$(Get-Random -Maximum 99999)"   # must be globally unique

az group create -n $RG -l $LOC

# File share for uploaded images/PDFs (survives restarts and redeploys)
az storage account create -n $SA -g $RG -l $LOC --sku Standard_LRS --kind StorageV2
az storage share-rm create --storage-account $SA -g $RG --name uploads --quota 5
$KEY = az storage account keys list -n $SA -g $RG --query "[0].value" -o tsv

# Container Apps environment (Consumption = no base cost)
az containerapp env create -n $ENV -g $RG -l $LOC
az containerapp env storage set -n $ENV -g $RG --storage-name uploads `
  --azure-file-account-name $SA --azure-file-account-key $KEY `
  --azure-file-share-name uploads --access-mode ReadWrite
```

## 4. Create the app (fill in the 3 placeholders)
```powershell
az containerapp create -n $APP -g $RG --environment $ENV `
  --image ghcr.io/techsquare1/hes-backend:latest `
  --registry-server ghcr.io --registry-username TechSquare1 --registry-password "<GITHUB_READ_PACKAGES_TOKEN>" `
  --ingress external --target-port 8080 `
  --cpu 0.25 --memory 0.5Gi --min-replicas 0 --max-replicas 1 `
  --secrets mongodb-uri="<NEW_MONGODB_URI>" jwt-secret="<NEW_JWT_SECRET>" `
  --env-vars MONGODB_URI=secretref:mongodb-uri JWT_SECRET=secretref:jwt-secret NODE_ENV=production JWT_EXPIRE=7d PORT=8080
```
`min-replicas 0` lets it scale to zero (free when idle). `max-replicas 1` caps cost and keeps uploads consistent.

## 5. Mount the uploads share (Portal, about 2 minutes)
Azure Portal → Container App **hes-backend**:
1. **Volumes** → Add → Azure file volume, name `uploads`, file share `uploads` → Save
2. **Containers** → Edit and deploy → select the container → **Volume mounts** → add `uploads` at path **`/app/uploads`** → Save → Create

## 6. Test the new backend
```powershell
$URL = az containerapp show -n $APP -g $RG --query properties.configuration.ingress.fqdn -o tsv
"https://$URL/health"
```
Open `https://<fqdn>/health`, which should return `{"ok":true,...}`, and `https://<fqdn>/`, which should show the API JSON.
Check the logs say "MongoDB Connected": `az containerapp logs show -n $APP -g $RG --tail 50`

## 7. Switch the app over (no reinstall)
Cloudflare Dashboard → Workers → **hes-api** → Edit code → change one line:
```js
const ORIGIN = 'https://<fqdn-from-step-6>'
```
Deploy, then check `https://hes-api.pakkhan9009.workers.dev/health`, and log in from the app on mobile data.
**Rollback:** set `ORIGIN` back and deploy again.

## 8. Auto-deploy on every push (like Railway)
```powershell
$SUB = az account show --query id -o tsv
az ad sp create-for-rbac --name hes-backend-deployer --role contributor `
  --scopes /subscriptions/$SUB/resourceGroups/$RG --json-auth
```
GitHub repo → Settings → Secrets and variables → Actions:
- **Secret** `AZURE_CREDENTIALS` = the whole JSON output above
- **Variables** `AZURE_RG` = `hes-rg`, `AZURE_APP_NAME` = `hes-backend`

From now on, `git push newgh main` builds the image and updates Azure automatically.

## 9. Budget alert
Portal → Cost Management → Budgets → Add → $2/month, with an email alert at 80%.

---
**Notes**
- Files uploaded to Railway's disk can't be moved over. Those images/PDFs need to be re-uploaded once. All database records stay as they are.
- The first request after idle takes a few seconds while the container wakes up. The app's 30s timeout covers this.
