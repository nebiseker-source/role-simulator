import os
import subprocess
import tempfile
from pathlib import Path


BASE_MODEL = "qwen2.5:7b-instruct"
CHAR_DIR = Path("characters")


def sanitize_model_name(name: str) -> str:
    s = name.strip().lower()
    allowed = "abcdefghijklmnopqrstuvwxyz0123456789-_"
    cleaned = "".join(ch if ch in allowed else "-" for ch in s)
    while "--" in cleaned:
        cleaned = cleaned.replace("--", "-")
    return cleaned.strip("-")


def build_modelfile_content(system_prompt: str) -> str:
    safe = system_prompt.replace('"', '\\"')
    return f"""FROM {BASE_MODEL}
PARAMETER temperature 0.7
SYSTEM "{safe}"
"""


def create_model_from_txt(txt_path: Path):
    model_name = sanitize_model_name(txt_path.stem)
    system_prompt = txt_path.read_text(encoding="utf-8").strip()

    if not model_name:
        print(f"SKIP: Geçersiz model adı ({txt_path.name})")
        return
    if not system_prompt:
        print(f"SKIP: Boş içerik ({txt_path.name})")
        return

    temp_modelfile = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            suffix=".Modelfile",
            delete=False,
        ) as f:
            temp_modelfile = f.name
            f.write(build_modelfile_content(system_prompt))

        print(f"--- {model_name} oluşturuluyor ({txt_path.name}) ---")
        subprocess.run(["ollama", "create", model_name, "-f", temp_modelfile], check=True)
        print(f"OK: {model_name}")
    except subprocess.CalledProcessError as e:
        print(f"HATA: {model_name} oluşturulamadı -> {e}")
    finally:
        if temp_modelfile and os.path.exists(temp_modelfile):
            os.remove(temp_modelfile)


def main():
    if not CHAR_DIR.exists():
        raise FileNotFoundError("characters/ klasörü bulunamadı.")

    txt_files = sorted(CHAR_DIR.glob("*.txt"))
    if not txt_files:
        print("characters/ içinde .txt dosyası bulunamadı.")
        return

    for txt in txt_files:
        create_model_from_txt(txt)


if __name__ == "__main__":
    main()
