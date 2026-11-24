import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))
FILES = {
    "manifest.json", "sync-core.js", "editor/app.js", "editor/term-files.js",
    MANIFEST["background"]["service_worker"], MANIFEST["side_panel"]["default_path"],
    *MANIFEST["icons"].values(), *MANIFEST["action"]["default_icon"].values(),
    *(script for entry in MANIFEST["content_scripts"] for script in entry["js"]),
}


def build():
    output = ROOT / "dist" / f"korean-translator-for-udemy-{MANIFEST['version']}.zip"
    output.parent.mkdir(exist_ok=True)
    payload = {}
    for name in sorted(FILES):
        data = (ROOT / name).read_bytes()
        if Path(name).suffix in {".js", ".json", ".html"}:
            data = data.replace(b"\r\n", b"\n")
        payload[name] = data
    with ZipFile(output, "w", compression=ZIP_DEFLATED) as archive:
        for name, data in payload.items():
            archive.writestr(ZipInfo(name), data, compress_type=ZIP_DEFLATED)
    with ZipFile(output) as archive:
        if archive.testzip() or {name: archive.read(name) for name in archive.namelist()} != payload:
            raise RuntimeError("Release ZIP differs from its source files")
    checksum = hashlib.sha256(output.read_bytes()).hexdigest()
    output.with_suffix(".sha256").write_text(f"{checksum}  {output.name}\n", encoding="ascii")
    print(f"{checksum}  {output}")


if __name__ == "__main__":
    build()
