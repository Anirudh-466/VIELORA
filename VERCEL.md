# Deploying VEILORA to Vercel (Step-by-Step)

VEILORA is pre-configured with **[vercel.json](file:///F:/VEILORA/vercel.json)** and serverless API endpoints in `/api/` so that it builds and deploys effortlessly on [Vercel](https://vercel.com).

---

## 🚀 Method 1: Deploy with Git (Recommended - 1 Click)

1. **Push your code to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Deploy VEILORA to Vercel"
   git remote add origin https://github.com/YOUR_USERNAME/veilora.git
   git push -u origin main
   ```

2. **Import into Vercel**:
   - Go to [vercel.com/new](https://vercel.com/new).
   - Select your `veilora` GitHub repository.
   - Leave the **Root Directory** as `./` (default).
   - Vercel automatically detects the build command and output directory from `vercel.json`:
     - **Build Command**: `npm install --prefix client && npm run build --prefix client`
     - **Output Directory**: `client/dist`
   - Click **Deploy**.

Your app will be live at `https://veilora-xxx.vercel.app` in under 60 seconds!

---

## ⚡ Method 2: Deploy with Vercel CLI (From Terminal)

You can deploy directly from your local terminal using the Vercel CLI:

```bash
# 1. Install Vercel CLI globally (or run with npx)
npx vercel

# 2. Follow the 3 prompts:
# ? Set up and deploy? [Y/n] y
# ? Which scope do you want to deploy to? (Select your account)
# ? Link to existing project? [y/N] n
# ? What's your project's name? veilora
# ? In which directory is your code located? ./

# 3. For production release:
npx vercel --prod
```

---

## 🛠️ Architecture on Vercel

1. **Frontend**: Vite 8 + React 19 single-page application compiled into `client/dist` and delivered through Vercel's global CDN.
2. **Serverless Functions**: 
   - `/api/rooms/create`: Ephemeral room generation.
   - `/api/rooms/verify`: Room existence verification.
   - `/api/signal`: Lightweight serverless HTTP polling relay for WebRTC SDP offers/answers and ICE candidates.
3. **Optional External WebSockets**: 
   If you wish to use a dedicated WebSocket signaling server instead of serverless polling, simply add an environment variable in your Vercel Project Settings:
   - `VITE_SIGNALING_URL`: `https://your-render-or-railway-app.com`
