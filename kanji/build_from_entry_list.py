from kanji_deck_builder import get_entries_from_file, write_txt_file, KanjiBundleManager

ENTRIES_FILE = "entries"

if __name__ == "__main__":
  manager = KanjiBundleManager()
  print("Reading entries...")
  entries = get_entries_from_file(ENTRIES_FILE)
  print(f"Loaded {len(entries)} valid entries.")
  
  print("Building kanji bundles...")
  for word, kana, eng in entries:
    manager.add_entry(word, kana, eng)
    
  # Export to our pipe-separated text format
  exported_text = manager.export_to_txt()

  # Save to a file (this is what you'd import into Anki / our web app)
  filename = "anki_notes.txt"
  write_txt_file(filename, exported_text)
  print(f"\nSuccessfully generated and saved notes to '{filename}'.")
