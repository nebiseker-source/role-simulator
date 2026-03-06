import json
import os
import subprocess
import tempfile
from pathlib import Path


BASE_MODEL = "qwen2.5:7b-instruct"
CHARACTERS_FILE = Path("characters.json")


def load_characters(path: Path):
    if not path.exists():
        raise FileNotFoundError(f"{path} bulunamadi.")

    with path.open("r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("characters.json bir liste olmali.")

    for i, item in enumerate(data):
        if not isinstance(item, dict):
            raise ValueError(f"{i}. kayit object olmali.")
        if "name" not in item or "role" not in item:
            raise ValueError(f"{i}. kayitta 'name' ve 'role' zorunlu.")

    return data


def build_modelfile_content(name: str, role: str) -> str:
    return f"""FROM {BASE_MODEL}
PARAMETER temperature 0.8
SYSTEM "Sen Role Simulator'un {name} karakterisin. Rolun: {role}. Daima Turkce cevap ver."
"""


def create_model_for_character(name: str, role: str):
    temp_modelfile = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="utf-8",
            suffix=".Modelfile",
            delete=False,
        ) as f:
            temp_modelfile = f.name
            f.write(build_modelfile_content(name, role))

        print(f"--- {name} olusturuluyor... ---")
        subprocess.run(["ollama", "create", name, "-f", temp_modelfile], check=True)
        print(f"OK: {name} basariyla eklendi.")
    except subprocess.CalledProcessError as e:
        print(f"HATA: {name} olusturulamadi -> {e}")
    finally:
        if temp_modelfile and os.path.exists(temp_modelfile):
            os.remove(temp_modelfile)


def main():
    characters = load_characters(CHARACTERS_FILE)
    for char in characters:
        name = str(char["name"]).strip()
        role = str(char["role"]).strip()
        if not name:
            print("Bos isimli kayit atlandi.")
            continue
        create_model_for_character(name, role)


if __name__ == "__main__":
    main()
