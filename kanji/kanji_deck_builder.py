"""
Kanji Bundle Manager

Builds dynamic Anki flashcard bundles from vocabulary entries. 
It groups words, kana, English definitions, and readings by their shared kanji.
Exports to pipe-separated values (|) for easy Anki imports and updates.
"""

import re
from typing import Dict, Any, List, Tuple

# Matches standard CJK Unified Ideographs (Kanji), ignoring kana/punctuation.
KANJI_PATTERN = re.compile(r'[\u4E00-\u9FAF]')


def read_txt_file(filepath: str) -> str:
  with open(filepath, 'r', encoding='utf-8') as f:
    return f.read()


def write_txt_file(filepath: str, text: str) -> None:
  with open(filepath, 'w', encoding='utf-8') as f:
    f.write(text)


def get_entries_from_file(filepath: str) -> List[Tuple[str, str, str]]:
  entries = []
  content = read_txt_file(filepath)
  for line_num, line in enumerate(content.strip().split('\n'), 1):
    if not line.strip():
      continue
    
    parts = line.split('|')
    if len(parts) != 3:
      print(f"WARNING (Line {line_num}): Does not have exactly 2 pipe separators. Ignoring -> {line}")
      continue
    entries.append((parts[0].strip(), parts[1].strip(), parts[2].strip()))
  return entries


class KanjiBundleManager:
  def __init__(self):
    # Standard dicts in Python 3.7+ maintain insertion order automatically.
    self.bundles: Dict[str, Dict[str, Any]] = {}

  def apply_xtsu(self, r: str) -> str:
    """Replaces trailing lone consonants (except 'n') with 'xtsu'."""
    if not r: return r
    last = r[-1].lower()
    if last in "bcdfghjklmpqrstvwxyz" and last != 'n':
      return r[:-1] + "xtsu"
    return r

  def devoice(self, r: str) -> str:
    """Canonicalizes readings to a base unvoiced form so they group together."""
    if not r: return r
    r_lower = r.lower()
    
    # Direct full-syllable overrides for irregular Hepburn pairs
    prefixes = {
        'ji': 'shi',
        'di': 'chi',
        'du': 'tsu',
        'zu': 'su',
    }
    for voiced, unvoiced in prefixes.items():
        if r_lower.startswith(voiced):
            return unvoiced + r_lower[len(voiced):]
            
    # Generic consonant replacements
    if r_lower.startswith('g'): return 'k' + r_lower[1:]
    if r_lower.startswith('z'): return 's' + r_lower[1:]
    if r_lower.startswith('d'): return 't' + r_lower[1:]
    if r_lower.startswith('b') or r_lower.startswith('p') or r_lower.startswith('f'): return 'h' + r_lower[1:]
    if r_lower.startswith('j'): return 'sh' + r_lower[1:]
    
    return r_lower

  def score_voicing(self, r: str) -> int:
    """Helper to pick the unvoiced 'label' from a group of merged readings."""
    if not r: return 0
    if r.lower().startswith(('b', 'p', 'd', 'g', 'z', 'j')): return 1
    return 0

  def add_entry(self, word: str, kana: str, eng: str) -> None:
    # Ordered list of kanji (allows safe iteration and maintains string order)
    kanjis_in_word = [char for char in word if KANJI_PATTERN.match(char)]
    
    # Deduplicate kanji while preserving their first-seen order left-to-right
    unique_kanjis_ordered = list(dict.fromkeys(kanjis_in_word))
    
    # Extract readings bounded by backticks
    readings = re.findall(r'`(.*?)`', kana)
    
    assigned_readings = {k: [] for k in unique_kanjis_ordered}
    
    # CASE A: No backticks (assign whole word reading to all kanji)
    if len(readings) == 0:
      clean_kana = kana.replace('`', '').strip()
      for k in unique_kanjis_ordered:
        assigned_readings[k].append(clean_kana)
        
    # CASE B: Valid multiple of readings to kanji count
    elif len(kanjis_in_word) > 0 and len(readings) % len(kanjis_in_word) == 0:
      num_k = len(kanjis_in_word)
      num_sets = len(readings) // num_k
      for i, k in enumerate(kanjis_in_word):
        for set_idx in range(num_sets):
          raw_reading = readings[i + set_idx * num_k]
          r_norm = self.apply_xtsu(raw_reading)
          assigned_readings[k].append(r_norm)
          
    # CASE C: Format Error
    else:
      print(f"WARNING: Mismatched backticks in '{word}'|'{kana}'. Expected multiple of {len(kanjis_in_word)} but got {len(readings)}.")
      clean_kana = kana.replace('`', '').strip()
      for k in unique_kanjis_ordered:
        assigned_readings[k].append(clean_kana)

    # Attach to state dictionary, relying on the first-seen order
    for kanji in unique_kanjis_ordered:
      if kanji not in self.bundles:
        self.bundles[kanji] = {
          "words": [], "kana": [], "eng": [],
          "seen": set(), "word_readings": {}
        }
      
      bundle = self.bundles[kanji]
      
      if word not in bundle["seen"]:
        bundle["seen"].add(word)
        bundle["words"].append(word) # Maintains chronological order
        bundle["kana"].append(kana)
        bundle["eng"].append(eng)
        bundle["word_readings"][word] = []
      
      # Map reading assignment, maintaining the order they were assigned
      for r in assigned_readings[kanji]:
        if r not in bundle["word_readings"][word]:
          bundle["word_readings"][word].append(r)

  def export_to_txt(self) -> str:
    lines = []
    
    for kanji, data in self.bundles.items():
      words_str = "; ".join(data["words"])
      kana_str = "; ".join(data["kana"])
      eng_str = "; ".join(data["eng"])
      
      # 1. Gather all unique readings in first-appearance order
      ordered_all_readings = []
      seen_readings = set()
      for word in data["words"]:
        for r in data["word_readings"][word]:
          if r not in seen_readings:
            seen_readings.add(r)
            ordered_all_readings.append(r)
        
      groups = {}
      for r in ordered_all_readings: 
        dv = self.devoice(r)
        if dv not in groups: groups[dv] = []
        groups[dv].append(r)
        
      # 2. Pick the cleanest representative label for each group
      reading_to_label = {}
      for dv, group_readings in groups.items():
        # Sort internally ONLY to find the best representative label for the group
        best_label = sorted(group_readings, key=lambda x: (self.score_voicing(x), len(x), x))[0]
        for r in group_readings:
            reading_to_label[r] = best_label
            
      # 3. Map words to their group labels, maintaining deterministic insertion order
      label_to_words = {}
      ordered_labels = []
      
      for word in data["words"]:
        for r in data["word_readings"][word]:
          label = reading_to_label[r]
          if label not in label_to_words:
            label_to_words[label] = []
            ordered_labels.append(label)
          if word not in label_to_words[label]:
            label_to_words[label].append(word)
            
      # Format: label1:word1,word2;label2:word3
      readings_data_parts = []
      for label in ordered_labels:
        words_list_str = ",".join(label_to_words[label])
        readings_data_parts.append(f"{label}:{words_list_str}")
        
      readings_str = ";".join(readings_data_parts)
      
      # Write 5 columns
      line = f"{kanji}|{words_str}|{kana_str}|{eng_str}|{readings_str}"
      lines.append(line)
      
    return "\n".join(lines)
