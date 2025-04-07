
from pathlib import Path
import subprocess
import time
import shutil
import os
from pathlib import Path

for x in range(0, 3):
    # Get profile path
    profile_path = Path(f"test_profiles/testprofile_{x}").resolve()
    
    if Path(profile_path).is_dir():
        shutil.rmtree(profile_path)

    profile_path.mkdir(parents=True, exist_ok=True)
    
    # Setup instruction for making profile -headless
    instr = f'firefox -profile -headless -no-remote "{profile_path}"'
    print(instr)

    # Run instruction
    proc = subprocess.Popen(instr, shell=True)

    # Let the instruction run
    time.sleep(1)

    # Close firefox window that shows up after making profile
    proc.terminate()