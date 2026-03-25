"""
Kanji Bundle Manager

Builds dynamic Anki flashcard bundles from vocabulary entries. 
It groups words, kana, and English definitions by their shared kanji.
Exports to pipe-separated values (|) for easy Anki imports and updates.
"""

import re
from typing import Dict, Any, List, Tuple

# Matches standard CJK Unified Ideographs (Kanji), ignoring kana/punctuation.
KANJI_PATTERN = re.compile(r'[\u4E00-\u9FAF]')


def read_txt_file(filepath: str) -> str:
  """Reads a text file and returns its content as a string."""
  with open(filepath, 'r', encoding='utf-8') as f:
    return f.read()


def write_txt_file(filepath: str, text: str) -> None:
  """Writes a string to a text file."""
  with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)


def get_entries_from_file(filepath: str) -> List[Tuple[str, str, str]]:
  """
  Reads a file of pipe-separated entries (word|kana|eng) 
  and returns a list of (word, kana, eng) tuples.
  """
  entries = []
  content = read_txt_file(filepath)
  for line in content.strip().split('\n'):
    # Ignore empty lines
    if not line.strip():
      continue
    
    parts = line.split('|')
    if len(parts) == 3:
      entries.append((parts[0].strip(), parts[1].strip(), parts[2].strip()))
  return entries


class KanjiBundleManager:
  """
  Manages bundles of kanji vocabulary.
  
  Uses a dictionary for O(1) kanji lookups. Tracks 'seen' words in a set 
  to ensure O(1) duplicate checking when adding new entries.
  """

  def __init__(self):
    # The structure is: {kanji: {"words": [], "kana": [], "eng": [], "seen": set()}}
    self.bundles: Dict[str, Dict[str, Any]] = {}

  def add_entry(self, word: str, kana: str, eng: str) -> None:
    """
    Extracts all kanji from a word and adds the entry to their respective bundles.
    Example: '警備' updates the bundle for both '警' and '備'.
    """
    # Find all unique kanji in the word (filters out 'え', 'る', etc.)
    kanjis_in_word = set(KANJI_PATTERN.findall(word))

    for kanji in kanjis_in_word:
      # Initialize the bundle for this kanji if it doesn't exist
      if kanji not in self.bundles:
        self.bundles[kanji] = {
          "words": [], 
          "kana": [], 
          "eng": [], 
          "seen": set()
        }
      
      bundle = self.bundles[kanji]

      # Add the entry only if this exact word hasn't been added to this kanji yet
      if word not in bundle["seen"]:
        bundle["seen"].add(word)
        bundle["words"].append(word)
        bundle["kana"].append(kana)
        bundle["eng"].append(eng)

  def export_to_txt(self) -> str:
    """
    Generates a pipe-separated string representing all bundles.
    The primary key (Kanji) is the first column, allowing Anki to 
    seamlessly update existing notes upon re-import.
    """
    lines = []
    
    for kanji, data in self.bundles.items():
      # Join the lists with semicolons to avoid conflicts with English commas
      words_str = "; ".join(data["words"])
      kana_str = "; ".join(data["kana"])
      eng_str = "; ".join(data["eng"])
      
      # Format: Kanji | Words | Kana | English
      line = f"{kanji}|{words_str}|{kana_str}|{eng_str}"
      lines.append(line)
      
    return "\n".join(lines)

  def init_from_txt(self, text: str) -> None:
    """
    Parses a pipe-separated string to completely repopulate the manager's state.
    Allows picking up where you left off from a previously exported file.
    """
    self.bundles.clear()
    
    # Ignore completely empty strings
    if not text.strip():
      return

    for line in text.strip().split('\n'):
      parts = line.split('|')
      
      # Ensure the line has exactly our 4 expected fields
      if len(parts) == 4:
        kanji, words_str, kana_str, eng_str = parts
        
        # Split the semicolon-separated strings back into lists
        words_list = words_str.split("; ")
        kana_list = kana_str.split("; ")
        eng_list = eng_str.split("; ")
        
        # Reconstruct the dictionary state
        self.bundles[kanji] = {
          "words": words_list,
          "kana": kana_list,
          "eng": eng_list,
          "seen": set(words_list)
        }


if __name__ == "__main__":
  # 1. Initialize our manager
  manager = KanjiBundleManager()

  # 2. Add our sample vocabulary entries
  sample_entries = [
    ["備える", "そなえる", "prepare, get ready for"],
    ["警備", "けいび", "guard, policing"],
    ["準備", "じゅんび", "prepare, setup"],
    ["設備", "せつび", "equipment, facilities"],
    ["情け", "なさけ", "sympathy, mercy"],
    ["感情", "かんじょう", "emotion, feeling"],
    ["事情", "じじょう", "circumstances, reasons"],
    ["情報", "じょうほう", "information, news"]
  ]

  print("Adding entries...")
  for word, kana, eng in sample_entries:
    manager.add_entry(word, kana, eng)

  # 3. Export to our pipe-separated text format
  exported_text = manager.export_to_txt()
  print("\n--- Exported Notes ---")
  print(exported_text)

  # 4. Save to a file (this is what you'd import into Anki)
  filename = "anki_notes.txt"
  write_txt_file(filename, exported_text)
  print(f"\nSaved notes to '{filename}'.")

  # 5. Demonstrate reading back from the string/file to prove 'init_from_txt' works
  print("\nTesting 'init_from_txt' functionality...")
  new_manager = KanjiBundleManager()
  
  # Read the text we just saved
  file_content = read_txt_file(filename)
  
  # Load it into the new manager
  new_manager.init_from_txt(file_content)
  
  # Add one more word to prove we can seamlessly continue building
  new_manager.add_entry("友情", "ゆうじょう", "friendship")
  
  print("\n--- Updated Notes (After adding '友情') ---")
  print(new_manager.export_to_txt())
