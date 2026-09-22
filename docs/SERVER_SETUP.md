# Server-first Ubuntu setup

This project can run entirely on a remote Ubuntu server. Use the laptop for
editing code, committing changes, and Git operations. Do not run PostgreSQL,
Redis, Docker, Ollama, or the demo app on the laptop for this workflow.

The commands below assume Ubuntu 22.04 or 24.04, a non-root user with `sudo`,
and a server such as AWS Lightsail or EC2.

## 1. Prepare the server

Connect over SSH and install the base tools:

```bash
ssh <server_user>@<server_public_ip>

sudo apt update
sudo apt install -y ca-certificates curl git build-essential
```

Keep the server private while setting it up. Do not open application ports to
the public internet unless you intentionally want to expose the app.

## 2. Install Node.js and pnpm

Install the Node.js LTS line supported by the project. Node.js 22 is an example:

```bash
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt install -y nodejs
node --version
npm --version
```

Install pnpm:

```bash
sudo npm install --global pnpm
pnpm --version
```

## 3. Install and start Redis on Ubuntu

Redis runs directly on the server in this setup:

```bash
sudo apt install -y redis-server
sudo systemctl enable --now redis-server
redis-cli ping
```

The expected response is `PONG`. The server `.env` must use:

```dotenv
REDIS_URL=redis://localhost:6379
```

Do not use `redis://redis:6379` when the NestJS process runs directly on the
Ubuntu host. The hostname `redis` is only appropriate when the app runs inside
the same Docker Compose network as the Redis container.

## 4. Install and configure PostgreSQL on Ubuntu

Install PostgreSQL and start it:

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl enable --now postgresql
```

Create a dedicated database user and database. Replace every placeholder with
server-specific values; do not paste real credentials into this document:

```bash
sudo -u postgres psql
```

```sql
CREATE USER <db_user> WITH PASSWORD '<strong_server_password>';
CREATE DATABASE <db_name> OWNER <db_user>;
\q
```

The password in `DATABASE_URL` must be URL-encoded if it contains characters
such as `@`, `:`, `/`, or `#`.

## 5. Clone and install the project

Clone the repository on the server:

```bash
mkdir -p ~/apps
cd ~/apps
git clone <repository_url> aegis-sandbox-tool-engine
cd aegis-sandbox-tool-engine
pnpm install --frozen-lockfile
```

For future deployments, pull the reviewed Git commit on the server:

```bash
git pull --ff-only
pnpm install --frozen-lockfile
```

## 6. Create the server-only `.env`

Create `.env` on the Ubuntu server. The file must stay on the server and must
never be committed, copied into a pull request, or pasted into chat. The
repository `.gitignore` excludes `.env`.

```bash
cd ~/apps/aegis-sandbox-tool-engine
touch .env
chmod 600 .env
nano .env
```

Use placeholders while preparing the file, then replace them only on the
server with values appropriate for that server:

```dotenv
PORT=3000
DATABASE_URL=postgres://<db_user>:<url_encoded_db_password>@localhost:5432/<db_name>
REDIS_URL=redis://localhost:6379
OPENWEATHER_API_KEY=<server_openweather_key_or_empty>

LLM_PROVIDER=ollama
OLLAMA_BASE_URL=<ollama_cloud_or_remote_ollama_base_url>
OLLAMA_MODEL=<ollama_model_name>
OLLAMA_API_KEY=<server_ollama_key_or_empty>
DEFAULT_MODEL_ID=<default_model_id>
LLM_MODELS=[{"id":"<model_id>","provider":"ollama","model":"<ollama_model_name>"}]
```

No API keys or other secrets belong in the repository. If the selected Ollama
endpoint requires authentication, provide the key only in the server `.env`;
otherwise leave the placeholder empty. Ollama does not need to run on the
laptop. The server can call Ollama Cloud or another reachable Ollama endpoint
through `OLLAMA_BASE_URL`.

## 7. Run migrations and seed tools

From the project directory on the server:

```bash
pnpm db:migrate
```

Seed the registered tools when setting up a fresh database or when the project
requires the seed data:

```bash
pnpm db:seed:tools
```

Run the seed command only when appropriate for the database. Review the seed
script before using it against an existing database.

## 8. Build and run with PM2

Install PM2 once on the server, build the app, and start the compiled NestJS
process:

```bash
sudo npm install --global pm2
pnpm build
pm2 start dist/main.js --name aegis-sandbox-tool-engine
pm2 status
pm2 logs aegis-sandbox-tool-engine
```

Persist the process across reboots:

```bash
pm2 save
pm2 startup systemd
```

Run the `sudo` command printed by `pm2 startup systemd`, then save the process
list again:

```bash
pm2 save
```

After deploying a new commit:

```bash
git pull --ff-only
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm build
pm2 restart aegis-sandbox-tool-engine --update-env
```

## 9. Check the app

From the server itself:

```bash
curl http://127.0.0.1:3000/health
```

The health response should report the API, PostgreSQL, and Redis as healthy.
The demo is available at:

```text
http://127.0.0.1:3000/demo
```

For private laptop access without opening port 3000 publicly, use an SSH
tunnel from the laptop:

```bash
ssh -L 3000:127.0.0.1:3000 <server_user>@<server_public_ip>
```

Then open `http://localhost:3000/demo` in the laptop browser while the SSH
session remains connected.

## 10. Networking and public access

Port 3000 does not need to be opened in the AWS security group or Ubuntu
firewall for local server checks or SSH tunneling. Open it only if you
intentionally want direct public access to the app, and restrict the source
range whenever possible.

If the demo or API will be exposed publicly, use an Nginx reverse proxy later
instead of treating the NestJS port as the long-term public entry point. Add
TLS, authentication, and an appropriate firewall policy before public use.

Docker is optional. This server-first setup uses systemd-managed PostgreSQL and
Redis directly on Ubuntu and does not require Docker or Docker Compose. The
existing Docker files are a separate local/container workflow and are not
changed by this setup guide.

## Troubleshooting

### Redis connection refused

Check the service and use the host-local URL:

```bash
sudo systemctl status redis-server
redis-cli ping
```

```dotenv
REDIS_URL=redis://localhost:6379
```

`redis` is a Docker Compose service hostname, not the hostname for a process
running directly on the Ubuntu host.

### PostgreSQL connection failed

Check PostgreSQL and confirm that the database, user, password, and URL-encoded
password in `DATABASE_URL` match:

```bash
sudo systemctl status postgresql
sudo -u postgres psql -c "\l"
```

### Health check is unreachable

Check PM2 first:

```bash
pm2 status
pm2 logs aegis-sandbox-tool-engine --lines 100
```

Then verify locally on the server with `curl`. If localhost works but a public
request does not, inspect the AWS security group and Ubuntu firewall. Remember
that port 3000 should remain closed unless public exposure is intentional.

### Model requests fail

Confirm that `OLLAMA_BASE_URL` is reachable from the Ubuntu server and that the
configured model ID in `LLM_MODELS` matches `DEFAULT_MODEL_ID` or the requested
runtime model ID. Keep any required model credentials only in the server `.env`.
