import { io } from 'socket.io-client';

const SERVER_URL = 'http://localhost:3001';

async function post(path, body, ip = `10.0.0.${Math.floor(Math.random() * 250) + 1}`) {
  const res = await fetch(`${SERVER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': ip
    },
    body: JSON.stringify(body || {})
  });
  return { status: res.status, data: await res.json() };
}

async function runTests() {
  console.log('=====================================================');
  console.log('   VEILORA AUTOMATED VERIFICATION (SINGLE ROOM ID)   ');
  console.log('=====================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(desc, condition) {
    if (condition) {
      console.log(`✅ [PASS] ${desc}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${desc}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await fetch(`${SERVER_URL}/api/health`).then(r => r.json());
    assert('1. Ephemeral Signaling Server Health Check', health.status === 'online');

    // 2. Create Ephemeral Room (Clean Room ID only!)
    const createRes = await post('/api/rooms/create');
    assert('2. Clean, human-friendly Room ID generated', createRes.data.roomId && createRes.data.roomId.startsWith('veil-'));
    assert('3. Max 2 participants strictly configured', createRes.data.maxParticipants === 2);

    const roomId = createRes.data.roomId;

    // 4. Verify Room with Room ID only
    const verifyValid = await post('/api/rooms/verify', { roomId });
    assert('4. Room verification with Room ID succeeds', verifyValid.status === 200 && verifyValid.data.valid === true);

    // 5. Test Missing / Non-existent Room ID
    const verifyMissing = await post('/api/rooms/verify', { roomId: 'veil-999-999' });
    assert('5. Non-existent Room ID rejected with HTTP 404', verifyMissing.status === 404);

    // 6. Test Multi-client WebRTC Signaling Handshake
    const clientA = io(SERVER_URL, { transports: ['websocket'] });
    const clientB = io(SERVER_URL, { transports: ['websocket'] });

    await new Promise((resolve) => {
      clientA.on('connect', () => {
        assert('6. Client A connected via WebSocket', clientA.connected);
        resolve();
      });
    });

    // 7. Client A Joins
    const joinAPromise = new Promise((resolve) => {
      clientA.emit('join-room', { roomId, nickname: 'Host Falcon' });
      clientA.on('room-joined', (data) => {
        assert('7. Client A joins as Initiator (1/2)', data.isInitiator === true && data.participantCount === 1);
        resolve();
      });
    });
    await joinAPromise;

    // 8. Client B Joins with Room ID only
    const joinBPromise = new Promise((resolve) => {
      clientB.emit('join-room', { roomId, nickname: 'Guest Lynx' });
      clientB.on('room-joined', (data) => {
        assert('8. Client B joins as Participant 2 (2/2)', data.isInitiator === false && data.participantCount === 2);
        resolve();
      });
    });
    await joinBPromise;

    // 9. Server fires room-ready to both
    const readyPromise = new Promise((resolve) => {
      clientA.on('room-ready', (data) => {
        assert('9. Server fires room-ready event', data.initiatorId === clientA.id);
        resolve();
      });
    });
    await readyPromise;

    // 10. WebRTC SDP Offer Relay
    const offerPromise = new Promise((resolve) => {
      const mockOffer = { type: 'offer', sdp: 'v=0\r\no=- 12345 2 IN IP4 127.0.0.1\r\ns=VEILORA-Offer\r\n' };
      clientB.on('signal-offer', ({ offer, senderId }) => {
        assert('10. SDP Offer relayed to Client B', offer.sdp.includes('VEILORA-Offer') && senderId === clientA.id);
        resolve();
      });
      clientA.emit('signal-offer', { roomId, offer: mockOffer });
    });
    await offerPromise;

    // 11. WebRTC SDP Answer Relay
    const answerPromise = new Promise((resolve) => {
      const mockAnswer = { type: 'answer', sdp: 'v=0\r\no=- 54321 2 IN IP4 127.0.0.1\r\ns=VEILORA-Answer\r\n' };
      clientA.on('signal-answer', ({ answer, senderId }) => {
        assert('11. SDP Answer relayed to Client A', answer.sdp.includes('VEILORA-Answer') && senderId === clientB.id);
        resolve();
      });
      clientB.emit('signal-answer', { roomId, answer: mockAnswer });
    });
    await answerPromise;

    // 12. ICE Candidate Relay
    const icePromise = new Promise((resolve) => {
      const mockCandidate = { candidate: 'candidate:1 1 UDP 2130706431 127.0.0.1 50000 typ host', sdpMid: '0', sdpMLineIndex: 0 };
      clientB.on('signal-ice-candidate', ({ candidate }) => {
        assert('12. ICE candidate relayed cleanly', candidate.candidate.includes('typ host'));
        resolve();
      });
      clientA.emit('signal-ice-candidate', { roomId, candidate: mockCandidate });
    });
    await icePromise;

    // 13. Max 2 Enforced (Client C rejected)
    const clientC = io(SERVER_URL, { transports: ['websocket'] });
    const fullRoomPromise = new Promise((resolve) => {
      clientC.emit('join-room', { roomId, nickname: 'Intruder' });
      clientC.on('join-error', (err) => {
        assert('13. Max 2 participants strictly enforced', err.message.includes('full'));
        clientC.disconnect();
        resolve();
      });
    });
    await fullRoomPromise;

    // 14. Clean Disconnection
    const clientAId = clientA.id;
    const leavePromise = new Promise((resolve) => {
      clientB.on('peer-disconnected', ({ peerId }) => {
        assert('14. Disconnection event cleanly delivered', peerId === clientAId);
        resolve();
      });
      clientA.disconnect();
    });
    await leavePromise;

    clientB.disconnect();

    // 15. Frontend static assets verified
    const html = await fetch(`${SERVER_URL}/`).then(r => r.text());
    assert('15. Production HTML delivered cleanly', html.includes('VEILORA'));

    console.log('\n=====================================================');
    console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
    console.log('=====================================================\n');

    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test error:', err);
    process.exit(1);
  }
}

runTests();
