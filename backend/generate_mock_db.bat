@echo off
REM Script para gerar banco de dados mockado no Windows

echo.
echo ================================
echo   Banco de Dados Mockado
echo ================================
echo.

REM Verificar se estamos no diretório correto
if not exist "requirements.txt" (
    echo Erro: Execute este script no diretorio backend/
    pause
    exit /b 1
)

REM Verificar se o Python está instalado
python --version >nul 2>&1
if errorlevel 1 (
    echo Erro: Python nao encontrado
    pause
    exit /b 1
)

REM Backup do banco existente
if exist "test.db" (
    echo.
    echo 📁 Fazendo backup do banco antigo...
    
    for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set mydate=%%c%%a%%b)
    for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set mytime=%%a%%b)
    
    set backup_name=test.db.backup_%mydate%_%mytime%
    ren test.db !backup_name!
    
    echo    ✓ Backup criado: !backup_name!
)

echo.
echo 📊 Gerando novo banco de dados mockado...
echo.

python create_mock_database.py

if errorlevel 1 (
    echo.
    echo ❌ Erro ao gerar o banco!
    pause
    exit /b 1
)

echo.
echo ✅ Banco de dados criado com sucesso!
echo.
echo Arquivos:
echo   - test.db (novo banco)
echo   - test.db.backup_* (backup anterior, se existia)
echo.
pause
