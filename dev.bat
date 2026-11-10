@echo off
title VEILORA — Development Mode (HMR)
color 0B
cls

echo ===================================================================
echo     VEILORA — Development Mode (Vite HMR + Signaling Server)
echo ===================================================================
echo.
echo Starting backend server on port 3001 and Vite client on port 5173...
echo.

start "" http://localhost:5173
npm run dev

pause
