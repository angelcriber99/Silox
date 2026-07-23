import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # Regex to match the faulty async let delay: () = ...
    pattern = r'async let delay: \(\) = try\? await Task\.sleep\(nanoseconds: 600_000_000\)'
    
    def replacer(match):
        return r'async let delay = try? await Task.sleep(nanoseconds: 600_000_000)'

    new_content = re.sub(pattern, replacer, content)

    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

root_dir = "ios/App/App"
for dirpath, _, filenames in os.walk(root_dir):
    for filename in filenames:
        if filename.endswith(".swift"):
            process_file(os.path.join(dirpath, filename))
