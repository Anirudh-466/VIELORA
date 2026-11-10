# VEILORA

> **"YOUR SPACE. YOUR PEOPLE. YOUR PRIVACY."**  
> Conversations Without Boundaries. Connect privately. Communicate freely. No accounts. No tracking. Just you and the people who matter.

---

## 1. Project Overview

**VEILORA** is a zero-knowledge, zero-registration, peer-to-peer (P2P) ephemeral video calling and real-time messaging application. Built for uncompromising privacy, VEILORA operates under a zero-storage architecture: no databases, no user accounts, no analytics, no third-party tracking scripts, and no persistent call logs.

All audio and video tracks travel directly between participants over WebRTC DTLS-SRTP encryption, while real-time text chat and direct file transfers are secured with client-side **AES-GCM-256** encryption using session keys derived via PBKDF2 with SHA-256.

---

## 2. Technology Stack

- **Frontend**: React 19, Vite 8, Tailwind CSS v4, Framer Motion, Lucide Icons, Canvas Confetti, QRCode
- **Cryptography**: W3C Web Crypto API (`AES-GCM-256`, `PBKDF2`, `SHA-256`)
- **Real-Time P2P Engine**: WebRTC (`RTCPeerConnection`, `RTCDataChannel`, Google STUN)
- **Signaling Server**: Node.js, Express, Socket.io (RAM-only ephemeral room coordinator)
- **Audio Synthesis**: W3C Web Audio API (Synthesized UI audio feedback, 0 external audio files)
- **Licensing**: Free and Open-Source under the Permissive MIT License

---

## 3. Core Features

### 🛡️ Ephemeral Room Generation
- **Single Simple Room ID**: Clean, human-friendly 6-character room IDs (e.g. `veil-749-218`). No complex links, tokens, or secondary keys needed.
- **Strict 2-Participant Limit**: Rooms strictly enforce a maximum of 2 participants. Unauthorized 3rd participants are rejected.
- **Auto-Expiry TTL**: Unused rooms and abandoned sessions are automatically purged from RAM after timeout.

### 🎥 High-Definition Video Calling
- **Remote Video Display**: Adaptive aspect ratio scaling with low latency.
- **Floating PIP Local Preview**: Movable, draggable local camera window with toggleable mirror mode and background blur.
- **Microphone & Camera Controls**: Instant hardware mute/unmute with visual audio level meter.
- **Screen Sharing**: Seamless screen/window/tab sharing via `getDisplayMedia` with automatic track replacement and return-to-camera recovery.
- **Picture-in-Picture & Fullscreen**: Native browser PiP (`requestPictureInPicture`) and Fullscreen API.
- **Call Duration Counter**: Real-time timer (`HH:MM:SS`).
- **Connection Quality Monitor**: Live polling of RTT, packet loss, and connection status badges (Excellent / Good / Poor).

### 💬 End-to-End Encrypted Chat
- **Direct WebRTC DataChannel**: Text messages stream directly between browsers without touching the server.
- **Application-Level E2EE**: Encrypted client-side with AES-GCM-256 using the room secret.
- **Self-Destructing Messages**: Selectable auto-destruction timers (Off, 10s, 30s, 1m, 5m) with visual countdown badges and RAM purge upon expiration.
- **Typing Indicator**: Real-time typing notification with debounced broadcasting.
- **Reactions & Emojis**: Quick emoji bar and message reaction badges.
- **Copy Message**: One-click message copying.
- **Unread Counter**: Glowing badge on chat toggle when closed.

### 📁 Direct P2P File Sharing
- **Zero Cloud Uploads**: Files stream directly peer-to-peer over WebRTC `RTCDataChannel` in 64KB chunks.
- **Supported Formats**: Images (with thumbnail preview), PDFs, Documents, Media up to 100MB.
- **Transfer Controls**: Accept/Reject prompts, live progress bars, transfer cancellation, and instant browser memory download.

### 👻 Additional Privacy & Security
- **Ghost Mode**: Automatic or customizable temporary aliases (e.g., *Shadow Falcon*, *Cipher Lynx*).
- **Session Safety Number**: 30-digit SHA-256 session fingerprint allowing participants to out-of-band verify zero Man-in-the-Middle (MITM) interception.
- **No Automatic Recording**: Calls are never recorded.
- **No Third-Party Trackers**: Clean codebase free of Google Analytics, Facebook Pixel, advertising beacons, or cookies.

---

## 4. Installation & Local Development

### Prerequisites
- Node.js (v18.x, v20.x, or v24.x)
- npm (v9.x or later)

### Quick Start
```bash
# 1. Clone repository
git clone https://github.com/your-username/veilora.git
cd veilora

# 2. Install backend dependencies
npm install

# 3. Install frontend dependencies
npm install --prefix client

# 4. Build frontend assets
npm run build

# 5. Start unified production server
npm start
```
The application will be live at `http://localhost:3001`.

### Development Mode (Concurrent Vite + Server)
To run Vite with hot-module replacement (HMR) alongside the signaling server:
```bash
npm run dev
```
- Frontend dev server: `http://localhost:5173`
- Signaling server: `http://localhost:3001`

---

## 5. Automated Testing Suite

VEILORA includes an automated 20-check test suite verifying all cryptographic, room lifecycle, WebRTC signaling, rate-limiting, and P2P communication behaviors:

```bash
# Run the 20-point verification test
node test-runner.js
```

### Verification Checks:
1. Ephemeral Signaling Server Health Check
2. Cryptographically secure Room ID generation
3. Separate high-entropy room secret generation
4. Maximum 2 participants limit enforcement
5. Room verification with valid credentials
6. Unauthorized room access rejection (HTTP 403)
7. Missing Room ID uniform rejection (anti-enumeration)
8. Anti-abuse rate-limiting trigger on floods
9. Client A WebSocket transport connection
10. Client A entry as Initiator
11. Client B entry as Participant 2
12. Signaling server `room-ready` handshake trigger
13. Third participant rejection on full room
14. WebRTC SDP Offer relay
15. WebRTC SDP Answer relay
16. ICE candidate bidirectional exchange
17. Encrypted chat payload relay
18. Message reaction relay
19. Peer disconnection clean broadcast
20. Production frontend static asset delivery

---

## 6. Environment Variables

| Variable | Description | Default |
| :--- | :--- | :--- |
| `PORT` | HTTP & WebSocket server port | `3001` |
| `CLIENT_ORIGIN` | Allowed CORS origin for signaling | `*` |
| `NODE_ENV` | Runtime environment (`development` / `production`) | `production` |

---

## 7. STUN / TURN Configuration & Production Realities

VEILORA is configured by default with public Google STUN servers:
```javascript
export const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' }
];
```

### Realistic Production Costs & Limitations:
- **Free STUN vs Paid TURN**: STUN handles public IP mapping for ~85-90% of residential network connections at zero cost.
- **Symmetric NATs / Corporate Firewalls**: ~10-15% of WebRTC calls fail direct P2P connection due to strict symmetric firewalls. In enterprise or cellular networks, a **TURN relay** server is mandatory.
- **Relay Bandwidth**: TURN servers relay end-to-end encrypted SRTP video packets without decryption keys. High-definition video uses roughly **1.0 to 1.5 GB per hour per participant**. In large-scale production deployments, TURN relay bandwidth is the primary ongoing infrastructure cost (e.g. self-hosting [Coturn](https://github.com/coturn/coturn) on a VPS like Hetzner/DigitalOcean, or managed Coturn services).

---

## 8. Security Architecture & Threat Model

1. **URL Key Isolation via Hash Fragment**:
   Invitation links use URL hash fragments: `https://domain.com/#room=<id>&key=<secret>`. Browsers **never** send hash fragments to HTTP servers in request headers. The secret key remains exclusively within the user's local browser memory.
2. **Timing-Safe Constant-Time Verification**:
   Room secrets are checked on the server using `crypto.timingSafeEqual` over SHA-256 hashes, eliminating side-channel timing attacks.
3. **In-Memory Rate Limiting**:
   Ephemeral sliding-window rate limiters restrict room creation and verification attempts per IP to prevent room enumeration and brute-force guessing.
4. **Active MITM Defense**:
   Users can compare their **30-digit Safety Number** to verify that signaling has not been intercepted by an active attacker.
5. **No Conversation Storage**:
   Signaling servers retain zero message plaintext. Once a call ends, all React state, WebRTC tracks, and DataChannels are destroyed and garbage collected.

---

## 9. License

This project is licensed under the permissive **MIT License**. Free for personal and commercial use.
