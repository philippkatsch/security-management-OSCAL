import os
import re

def process_file(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        try:
            with open(filepath, 'r', encoding='utf-16') as f:
                content = f.read()
        except Exception:
            return

    original = content
    
    # Handle imports like: import ... from '../../hooks/something'
    content = re.sub(r"from\s+'((?:\.\./)+)(hooks|lib|stores|components)(/[^']+)'", lambda m: f"from '@{m.group(2)}{m.group(3)}'", content)
    content = re.sub(r'from\s+"((?:\.\./)+)(hooks|lib|stores|components)(/[^"]+)"', lambda m: f'from "@{m.group(2)}{m.group(3)}"', content)
    
    # Handle imports like: import ... from '../../hooks'
    content = re.sub(r"from\s+'((?:\.\./)+)(hooks|lib|stores|components)'", lambda m: f"from '@{m.group(2)}'", content)
    content = re.sub(r'from\s+"((?:\.\./)+)(hooks|lib|stores|components)"', lambda m: f'from "@{m.group(2)}"', content)
    
    # Handle cross-domain component imports, usually `shared` or anything from `components/`
    # We'll just map `../shared` or `../../shared` to `@components/shared`
    content = re.sub(r"from\s+'((?:\.\./)+)shared(/[^']+)?'", lambda m: f"from '@components/shared{m.group(2) or ''}'", content)
    content = re.sub(r'from\s+"((?:\.\./)+)shared(/[^"]+)?"', lambda m: f'from "@components/shared{m.group(2) or ''}"', content)

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'Updated {filepath}')

for root, dirs, files in os.walk('c:/Users/phili/Desktop/Projects/Security-Management-OSCAL/reposol/frontend/src'):
    for file in files:
        if file.endswith(('.ts', '.tsx')):
            process_file(os.path.join(root, file))
