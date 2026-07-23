import os
import re

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # We want to replace:
    #         .refreshable {
    #             async let fetch: () = model.refresh()
    #             async let delay = try? await Task.sleep(nanoseconds: 600_000_000)
    #             _ = await (fetch, delay)
    #         }
    # Or similar, with:
    #         .refreshable {
    #             await model.refresh()
    #             try? await Task.sleep(nanoseconds: 300_000_000)
    #         }
    
    # Let's use regex to find the block
    pattern = re.compile(r'\.refreshable\s*\{\s*async let fetch:\s*\(\)\s*=\s*(.+?)\n\s*async let delay = try\? await Task\.sleep\(nanoseconds:\s*600_000_000\)\n\s*_\s*=\s*await \(fetch, delay\)\s*\}', re.MULTILINE)
    
    def replacer(match):
        call = match.group(1).strip()
        return f".refreshable {{\n            await {call}\n            try? await Task.sleep(nanoseconds: 300_000_000)\n        }}"

    new_content = pattern.sub(replacer, content)
    
    if new_content != content:
        with open(filepath, 'w') as f:
            f.write(new_content)
        print(f"Updated {filepath}")

root_dir = "ios/App/App"
for dirpath, _, filenames in os.walk(root_dir):
    for filename in filenames:
        if filename.endswith(".swift"):
            process_file(os.path.join(dirpath, filename))
