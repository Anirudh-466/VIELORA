@echo off
title VEILORA — Ephemeral P2P Video & Encrypted Chat
color 0A
cls

echo ===================================================================
echo     VEILORA: "YOUR SPACE. YOUR PEOPLE. YOUR PRIVACY."
echo     Zero-Knowledge Ephemeral Peer-to-Peer Encrypted Calls
echo ===================================================================
echo.
echo [1/2] Launching VEILORA Ephemeral Server on http://localhost:3001 ...
echo [2/2] Opening your browser automatically...
echo.
echo Press Ctrl+C in this terminal anytime to stop the server.
echo ===================================================================
echo.

start "" http://localhost:3001
node server.js

pause
