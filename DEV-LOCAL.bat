@echo off
title JobsitePro — dev local
cd /d "%~dp0"
echo.
echo  JobsitePro — serveur local
echo  ========================
echo  Patron  : http://localhost:5500/patron/
echo  Employe : http://localhost:5500/employe/
echo  API     : https://jobsitepro.example.com
echo.
echo  NE PAS double-cliquer index.html (file:// ne marche pas).
echo.
start "" "http://localhost:5500/patron/?reset=1"
echo  Si connexion echoue : cliquer "Tester le serveur" sur la page login.
echo  Ou utilisez directement : https://jobsitepro.example.com/patron/
echo.
npx --yes serve -p 5500
