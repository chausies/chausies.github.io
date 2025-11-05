# Workout Tracker

A simple, offline-first workout tracking web application that runs entirely in your browser. [Open source](source_code_file.com).

## Features

- **100% Offline**: No internet connection required - all data stored locally in your browser
- **Persistent Storage**: Data automatically saved to browser localStorage (survives browser restarts)
- **Smart Defaults**: Automatically pre-fills today's workout with your most recent routine
- **Flexible Exercise Tracking**: Define any workout with custom metrics (weight, reps, time, distance, etc.)
- **Edit History**: Load and modify any previous workout entry
- **Backup/Restore**: Export your entire workout history as JSON and import it back
- **Data Management**: Wipe all data from browser with confirmation safeguards
- **Mobile-Friendly**: Number inputs automatically trigger numeric keyboards on mobile devices
- **Fast Data Entry**: Press Enter to navigate between input fields seamlessly
- **Responsive Design**: Compact layout fits multiple metric inputs per line on mobile

## How It Works

### Data Structure

Data is organized as: `Date → Workout → Metrics → Values`

Example:
```
11/03/25
  └─ Lat Pulldown
      ├─ Weight (lb): 135
      ├─ Set 1 Reps: 10
      ├─ Set 2 Reps: 8
      ├─ Set 3 Reps: 6
      └─ Comment: Felt strong today
```

### Defining Workouts

In the "List of Workouts" text area, define exercises as comma-separated values:

```
Lat Pulldown, Weight (lb), Set 1 Reps, Set 2 Reps, Set 3 Reps
Chest Press, Weight (lb), Set 1 Reps, Set 2 Reps, Set 3 Reps
Elliptical, Time (min), Distance (mi), Resistance
Squats, Reps
```

Format: `Workout Name, Metric 1, Metric 2, Metric 3, ...`

Click **Update Workout List** to regenerate input fields. New workouts automatically populate with data from the most recent date they appeared.

### Daily Workflow

1. Open the app - it defaults to today's date with yesterday's workout template
2. Enter your workout values (numeric inputs for all metrics)
3. Optionally add comments for each exercise
4. Press Enter to move between input fields (or click/tap)
5. Click **Submit Workout** to save
6. Data automatically persists in your browser

**Note**: Submitting a workout completely overwrites that date's entry. This makes it easy to remove exercises - just delete them from your workout list, update it, and submit.

### Editing Past Workouts

1. Use the **Load workout from Date** dropdown
2. Select the date you want to edit
3. Modify values
4. Click **Submit Workout** to update

### Backup Your Data

- **Save Workout File**: Downloads your entire workout history as JSON
- **Load Workout File**: Imports a previously saved JSON file (overwrites current data in localStorage)
- **Wipe Workout Data**: Clears all workout data from browser localStorage (double confirmation required, backup recommended)

## First Time Use

The app loads with example exercises to demonstrate the format:
- Lat Pulldown (with weight and 3 sets)
- Chest Press (with weight and 3 sets)
- Elliptical (with time, distance, and resistance)
- Squats (with reps only)

Modify the "List of Workouts" to match your actual routine, then click **Update Workout List**.

## Technical Details

- Single HTML file - no installation required
- Uses localStorage for persistent browser storage (~5-10MB capacity)
- Date format: MM/DD/YY
- All processing happens client-side (JavaScript)
- Number inputs for metrics (mobile-friendly)
- Text inputs for comments
- Dark mode interface for comfortable viewing

## Pro Tips

💡 **Different routines for different days?** Just load a previous day's workout to load that routine+values, then change the date to today's.

💡 **Speed up data entry:** Instead of tapping the next input box, just hit "Enter" to go to it.

## Usage Tips

- **Consistency**: Keep the same workout names and metric labels for easy tracking over time
- **Comments**: Use the comment field to note how you felt, technique tips, or anything unusual
- **Regular Backups**: Periodically save your data using "Save Workout File" as a backup
- **Flexibility**: You can have different workouts on different days - the app adapts to whatever you enter

## Browser Compatibility

Works in all modern browsers that support localStorage (Chrome, Firefox, Safari, Edge, etc.)
