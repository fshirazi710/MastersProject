
from pathlib import Path
import subprocess

for x in range(0, 3):
    profile_path = Path(f"test_profiles/testprofile_{x}").resolve()

    profile_path.mkdir(parents=True, exist_ok=True)
    instr = f'firefox -profile "{profile_path}"'
    print(instr)
    subprocess.run(instr, shell=True, check=True)
