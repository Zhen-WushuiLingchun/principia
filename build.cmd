@echo off
cd principia
pyinstaller --onefile --name app app.py --distpath build
copy build\app.exe electron\
pause
npm install
npm run build
npm run electron:build
pause