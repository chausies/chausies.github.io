from kanji_deck_builder import get_entries_from_file, write_txt_file, KanjiBundleManager

ENTRIES_FILE = "entries"
if __name__ == "__main__":
  manager = KanjiBundleManager()
  print("Reading entries...")
  entries = get_entries_from_file(ENTRIES_FILE)
  print("Adding entries...")
  for word, kana, eng in entries:
    manager.add_entry(word, kana, eng)
  # 3. Export to our pipe-separated text format
  exported_text = manager.export_to_txt()
  print("\n--- Exported Notes ---")
  print(exported_text)

  # 4. Save to a file (this is what you'd import into Anki)
  filename = "anki_notes.txt"
  write_txt_file(filename, exported_text)
  print(f"\nSaved notes to '{filename}'.")
