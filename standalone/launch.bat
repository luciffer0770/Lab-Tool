@echo off
cd /d "%~dp0.."
set PYTHONPATH=%CD%
python standalone\gui.py
pause
