@echo off
pyinstaller --onefile --name app app.py
copy dist\app.exe principia\electron\
cd principia
npm install
npm run build
npm run electron:build