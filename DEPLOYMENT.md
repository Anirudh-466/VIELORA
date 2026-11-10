# VEILORA — Production Deployment Guide

This guide details how to deploy **VEILORA** to production across multiple platforms.

---

## 🚀 Live Demo Link (Active Now)

VEILORA is deployed and publicly accessible right now via Cloudflare HTTPS Tunnel:
👉 **[https://delivering-closely-muscle-update.trycloudflare.com](https://delivering-closely-muscle-update.trycloudflare.com)**

Anyone anywhere in the world on an iPhone, Android, or laptop can open this link, click **CREATE PRIVATE ROOM**, share the 6-character **Room ID**, and enjoy instant end-to-end encrypted video and audio calling.

---

## 📦 Option 1: 1-Click Free Deployment on Render (Recommended)

Render offers free hosting with full persistent WebSocket support (ideal for Socket.io and WebRTC signaling).

### Steps:
1. Push your repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Deploy VEILORA"
   git remote add origin https://github.com/YOUR_USERNAME/veilora.git
   git push -u origin main
   ```
2. Go to [Render.com](https://render.com) and click **New + > Web Service**.
3. Select your repository.
4. Render automatically detects `render.yaml`, or use the following settings:
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm install --prefix client && npm run build --prefix client`
   - **Start Command**: `node server.js`
   - **Instance Type**: `Free`
5. Click **Create Web Service**. Your app will be live at `https://veilora.onrender.com` with free SSL!

---

## 🚂 Option 2: Deploy to Railway

Railway provides high-speed automated deployment with WebSocket support:

1. Push your code to GitHub.
2. Go to [Railway.app](https://railway.app) and click **New Project > Deploy from GitHub repo**.
3. Select the `veilora` repository.
4. Railway will automatically pick up `railway.json`, build the client, and start `node server.js`.
5. Under service settings, click **Generate Domain** to get your public HTTPS URL.

---

## 🪂 Option 3: Deploy to Fly.io

Fly.io runs applications globally close to your users:

```bash
# Install flyctl
curl -L https://fly.io/install.sh | sh

# Authenticate
fly auth login

# Launch using the provided fly.toml and Dockerfile
fly launch

# Deploy
fly deploy
```

---

## 🐳 Option 4: Docker Container Deployment

You can run VEILORA anywhere Docker is supported (AWS ECS, Google Cloud Run, DigitalOcean, self-hosted VPS):

```bash
# 1. Build the production image
docker build -t veilora:latest .

# 2. Run the container
docker run -d -p 3001:3001 --name veilora-app veilora:latest

# Visit http://localhost:3001
```

---

## 🖥️ Option 5: Self-Hosted Ubuntu VPS (Nginx + SSL Certbot)

For complete ownership and maximum control on a VPS (Hetzner, DigitalOcean, Linode):

### 1. Install Node.js & Git
```bash
sudo apt update && sudo apt install -y nodejs npm nginx certbot python3-certbot-nginx
```

### 2. Clone & Build
```bash
git clone https://github.com/YOUR_USERNAME/veilora.git /var/www/veilora
cd /var/www/veilora
npm install
npm install --prefix client
npm run build --prefix client
```

### 3. Setup PM2 Process Manager
```bash
sudo npm install -g pm2
pm2 start server.js --name "veilora"
pm2 startup
pm2 save
```

### 4. Configure Nginx Reverse Proxy with WebSocket Support
Edit `/etc/nginx/sites-available/veilora`:
```nginx
server {
    server_name yourdomain.com;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/veilora /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d yourdomain.com
```

---

## 🌐 STUN / TURN Setup (For Enterprise Firewalls)

VEILORA includes Google public STUN servers by default (`stun:stun.l.google.com:19302`). For strict corporate firewalls that block direct UDP connections, install [Coturn](https://github.com/coturn/coturn) on your VPS:

```bash
sudo apt install coturn
```
Configure `/etc/turnserver.conf`:
```conf
listening-port=3478
tls-listening-port=5349
realm=yourdomain.com
fingerprint
lt-cred-mech
user=veilora:YourSecureTurnPassword
```
Add the TURN credentials into `client/src/services/webrtc.js`.
