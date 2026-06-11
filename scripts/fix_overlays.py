import os, re

files = [
    'sales-solubles-module.tsx',
    'sulfatos-solubles-module.tsx',
    'proctor-module.tsx',
    'humedad-module.tsx',
    'cbr-module.tsx',
]

base = r'C:\Users\Lenovo\Documents\crmnew\crm-geofal\src\components\dashboard'

for f in files:
    path = os.path.join(base, f)
    with open(path, 'r', encoding='utf-8') as fh:
        content = fh.read()
    if 'data-form-overlay' in content:
        print(f'SKIP (already done): {f}')
        continue
    old = '<div className="fixed inset-0 z-50 bg-slate-100'
    new = '<div data-form-overlay className="fixed inset-0 z-50 bg-slate-100'
    if old in content:
        new_content = content.replace(old, new, 1)
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(new_content)
        print(f'Updated: {f}')
    else:
        print(f'Pattern NOT found: {f}')
