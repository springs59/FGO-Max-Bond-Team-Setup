from datetime import datetime, timezone
from pathlib import Path
import os
import re
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else 'dist/index.html')
stamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
revision = os.environ.get('GITHUB_SHA') or datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')
text = path.read_text()
if 'name="build-time"' not in text:
    text = text.replace('<title>', f'<meta name="build-time" content="{stamp}" />\n    <title>', 1)
text = re.sub(r'(["\'])(\./src/[^"\']+\.(?:js|css))(?:\?[^"\']*)?\1',
              lambda m: f'{m[1]}{m[2]}?build={revision}{m[1]}', text)
path.write_text(text)
# All relative module edges need a version, not only app.js or the Worker entry.
pattern = re.compile(r'(["\'])(\.{1,2}/[^"\'\n]+\.js)(?:\?[^"\'\n]*)?\1')
for module in (path.parent / 'src').rglob('*.js'):
    module.write_text(pattern.sub(lambda m: f'{m[1]}{m[2]}?build={revision}{m[1]}', module.read_text()))
print('build-time', stamp, 'revision', revision)
