import os
import shutil
import subprocess
from datetime import datetime

# ================= CONFIGURATION =================
# 1. Source: Where are the files on your computer?
# Example (Windows): r"C:\Users\Sam\Documents\Zwift\Workouts\123456"
# Example (Mac): "/Users/Sam/Documents/Zwift/Workouts/123456"
SOURCE_DIR = r"PATH_TO_YOUR_ZWIFT_WORKOUTS_FOLDER"

# 2. Destination: Where in this repo should they go?
# This creates a 'zwift_library' folder in the same directory as this script
REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
DEST_FOLDER_NAME = "zwift_library"
DEST_DIR = os.path.join(REPO_ROOT, DEST_FOLDER_NAME)

# 3. File Types: What extensions to copy?
EXTENSIONS = [".zwo"] 
# =================================================

def sync_files():
    print(f"\n🚀 Starting Sync: {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    
    # --- Step 1: Copy Files ---
    if not os.path.exists(DEST_DIR):
        os.makedirs(DEST_DIR)
        print(f"   Created folder: {DEST_FOLDER_NAME}")

    files_copied = 0
    try:
        for filename in os.listdir(SOURCE_DIR):
            if any(filename.endswith(ext) for ext in EXTENSIONS):
                src = os.path.join(SOURCE_DIR, filename)
                dst = os.path.join(DEST_DIR, filename)
                
                # Check if file is new or modified
                if not os.path.exists(dst) or os.path.getmtime(src) > os.path.getmtime(dst):
                    shutil.copy2(src, dst)
                    files_copied += 1
                    print(f"   [+] Copied: {filename}")
        
        if files_copied == 0:
            print("   ✅ Files are already up to date locally.")
        else:
            print(f"   📂 Copied {files_copied} new/updated files.")

    except FileNotFoundError:
        print(f"   ❌ Error: Source directory not found: {SOURCE_DIR}")
        return

    # --- Step 2: Git Push ---
    print("\n🐙 GIT: Checking for changes...")
    try:
        # Change cwd to repo root to ensure git commands work
        os.chdir(REPO_ROOT)

        # Stage all changes
        subprocess.run(["git", "add", "."], check=True)

        # Check status
        status = subprocess.run(["git", "status", "--porcelain"], capture_output=True, text=True).stdout

        if status:
            commit_msg = f"Auto-Sync: Local Files {datetime.now().strftime('%Y-%m-%d')}"
            subprocess.run(["git", "commit", "-m", commit_msg], check=True)
            subprocess.run(["git", "push"], check=True)
            print("   ✅ Success: Changes pushed to GitHub!")
        else:
            print("   ℹ️  No git changes to commit.")

    except subprocess.CalledProcessError as e:
        print(f"   ⚠️ Git Error: {e}")
    except FileNotFoundError:
        print("   ⚠️ Error: 'git' command not found. Is Git installed?")

if __name__ == "__main__":
    sync_files()