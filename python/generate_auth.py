import os
import json
import hashlib

# Get the passwords from the Environment Variable
# If running locally without env var, default to empty
raw_passwords = os.environ.get('SITE_PASSWORDS', '')

if not raw_passwords:
    print("No passwords found in environment variables.")
    hashed_list = []
else:
    # Split by comma and strip whitespace
    pass_list = [p.strip() for p in raw_passwords.split(',') if p.strip()]
    
    # Hash them using SHA-256
    hashed_list = []
    for p in pass_list:
        # Encode string to bytes, hash it, get hex digest
        pw_hash = hashlib.sha256(p.encode('utf-8')).hexdigest()
        hashed_list.append(pw_hash)

# Output path (Root of repo)
# Go up one level from 'python/' directory
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
output_path = os.path.join(repo_root, 'auth_config.json')

# Write to file
with open(output_path, 'w') as f:
    json.dump(hashed_list, f)

print(f"Successfully generated {len(hashed_list)} password hashes to {output_path}")
