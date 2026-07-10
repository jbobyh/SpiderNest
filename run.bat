@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

echo Запуск HTTP-сервера на порту 8000...

REM Проверяем наличие python или py
where python >nul 2>&1
if %errorlevel%==0 (
    set PYTHON_CMD=python
) else (
    where py >nul 2>&1
    if %errorlevel%==0 (
        set PYTHON_CMD=py
    ) else (
        echo Ошибка: Python не найден в системе.
        echo Убедитесь, что Python установлен и добавлен в PATH.
        pause
        exit /b 1
    )
)

echo Используется команда: !PYTHON_CMD!
start "Python HTTP Server" !PYTHON_CMD! serve.py

REM Небольшая задержка для инициализации сервера
timeout /t 2 /nobreak >nul

echo Открываем браузер: http://localhost:8000/
start http://localhost:8000/