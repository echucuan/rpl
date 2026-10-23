@echo off
rem Abre Rocket Physics Lab en el navegador. Deja esta ventana abierta mientras lo usas.
cd /d "%~dp0"
echo Iniciando Rocket Physics Lab... (cierra esta ventana para apagarlo)
call npx vite --port 5174 --open /rpl/
