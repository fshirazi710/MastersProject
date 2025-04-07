
import os
import re
root = "C:/Users/fshir/AppData/Roaming/Mozilla/Firefox/Profiles/"
dirs = [ item for item in os.listdir(root) if os.path.isdir(os.path.join(root, item)) ]
valid_profiles = []

for folder in dirs:
    foldername = folder.split(".")[-1]
    if "testuser" in foldername:
        num = int(re.findall(r'\d+', foldername)[0])
        
        valid_profile_path = os.path.join(root, folder)
        valid_profiles.append(valid_profile_path)

profile_folder_root = "C:/Users/Fshir/Desktop/MENG/MastersProject/frontend/tests/test_profiles/"

for profile_path in valid_profiles:
    
    foldername = (profile_path.split("\\")[-1]).split(".")[-1]
    profile_folder = f"{profile_folder_root}{foldername}"
    print(profile_folder)
    instr = f"echo D | xcopy /E /H /K /Y \"{profile_path}\" \"{profile_folder}\""
    print(instr)
    os.system(instr)