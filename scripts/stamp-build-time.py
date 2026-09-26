from datetime import datetime, timezone
from pathlib import Path
import sys

path = Path(sys.argv[1] if len(sys.argv) > 1 else "dist/index.html")
stamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
text = path.read_text()
if 'name="build-time"' not in text:
    text = text.replace("<title>", f'<meta name="build-time" content="{stamp}" />\n    <title>', 1)
path.write_text(text)
print("build-time", stamp)
