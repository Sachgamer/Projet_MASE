# Script pour démarrer le serveur de développement Django
import subprocess
import sys
import os

os.chdir(r"c:\Users\A_SDE\Downloads\Projet_MASE-main\Projet_MASE-main\backend")
try:
    print("Starting process...")
    process = subprocess.Popen(
        [sys.executable, "manage.py", "runserver", "--noreload"],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    stdout, stderr = process.communicate(timeout=10)
    print("STDOUT:")
    print(stdout)
    print("STDERR:")
    print(stderr)
    print("EXIT CODE:", process.returncode)
except Exception as e:
    print("ERROR:", str(e))
