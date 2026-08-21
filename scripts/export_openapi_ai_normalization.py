import json
import sys
from pathlib import Path

if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

root_dir = Path(__file__).resolve().parents[1]
if str(root_dir) not in sys.path:
    sys.path.insert(0, str(root_dir))

from services.ai_normalization.main import app


def export_openapi():
    output_dir = root_dir / "docs" / "openapi"
    output_dir.mkdir(parents=True, exist_ok=True)
    output_file = output_dir / "ai_normalization.json"

    openapi_data = app.openapi()
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(openapi_data, f, indent=2)

    print(f"Exported OpenAPI specification to {output_file}")


if __name__ == "__main__":
    export_openapi()
