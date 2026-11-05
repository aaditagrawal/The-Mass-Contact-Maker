"""Check the original ZIP writer with Python's independent standard-library reader."""

from pathlib import Path
import subprocess
import tempfile
import zipfile


root = Path(__file__).resolve().parent.parent
with tempfile.TemporaryDirectory(prefix="contact-zip-check-") as folder:
    subprocess.run(["bun", "tests/write-zip-fixtures.js", folder], cwd=root, check=True)
    with zipfile.ZipFile(Path(folder) / "contacts.zip") as archive:
        assert archive.namelist() == [
            "équipe/", "équipe/班_batch1_contacts.vcf", "équipe/班_batch2_contacts.vcf",
            "/a/", "/a//b.vcf", "a/", "a/../", "a/../b.vcf", "a\\b.vcf",
            "empty.vcf", "replacement.vcf", "chunked.vcf",
        ]
        assert archive.testzip() is None
        assert archive.read("équipe/班_batch1_contacts.vcf") == (
            "BEGIN:VCARD\nFN:नमस्ते 😀\nEND:VCARD\n".encode()
        )
        assert archive.read("équipe/班_batch2_contacts.vcf") == (
            "BEGIN:VCARD\nFN:Zoë\nEND:VCARD\n".encode()
        )
        assert archive.read("replacement.vcf") == b"new"
        assert archive.read("empty.vcf") == b""
        assert archive.read("chunked.vcf") == (
            "a" * 65535 + "😀नमस्ते" + "b" * 65536 + "😀"
        ).encode()
        for entry in archive.infolist():
            assert entry.compress_type == zipfile.ZIP_STORED
            assert entry.flag_bits & 0x800
            if entry.filename.endswith("/"):
                assert entry.is_dir() and entry.file_size == 0
    for count in [65534, 65535, 65536]:
        path = Path(folder) / f"{count}.zip"
        with zipfile.ZipFile(path) as archive:
            assert len(archive.infolist()) == count
            assert archive.testzip() is None
            assert archive.read("0.vcf") == b"123456789"
            assert archive.read(f"{count - 1}.vcf") == b"123456789"
        assert (b"PK\x06\x06" in path.read_bytes()) == (count >= 65535)
print("ZIP interoperability, Unicode paths, CRCs and ZIP64 count boundaries passed")
