#!/bin/bash

# Define spacing and margins in pixels (adjust as needed)
PADDING=10   # Space between cards
MARGIN=100   # Border around the edge of the page

# Define total number of cards
TOTAL_CARDS=68

# Define cards per sheet
CARDS_PER_SHEET=4

# Calculate the total number of sheets needed
TOTAL_SHEETS=$(( (TOTAL_CARDS + CARDS_PER_SHEET - 1) / CARDS_PER_SHEET )) # Ceiling division

echo "Total cards: $TOTAL_CARDS"
echo "Cards per sheet: $CARDS_PER_SHEET"
echo "Generating $TOTAL_SHEETS sheets..."

# Loop through each sheet
for (( sheet_num=1; sheet_num<=TOTAL_SHEETS; sheet_num++ )); do
  # Calculate the base indices for the cards on this sheet
  idx1=$(( (sheet_num - 1) * CARDS_PER_SHEET + 1 ))
  idx2=$(( idx1 + 1 ))
  idx3=$(( idx1 + 2 ))
  idx4=$(( idx1 + 3 ))

  # Build the list of input files in the desired order for montage:
  # Top-Left:    idx2.png
  # Top-Right:   idx1.png
  # Bottom-Left: idx4.png
  # Bottom-Right:idx3.png
  input_files_ordered=() # Use bash array

  # Add files to the array only if their index is within the TOTAL_CARDS limit
  # Order determines placement in the 2x2 grid
  if (( idx2 <= TOTAL_CARDS )); then input_files_ordered+=("${idx2}.png"); fi
  if (( idx1 <= TOTAL_CARDS )); then input_files_ordered+=("${idx1}.png"); fi
  if (( idx4 <= TOTAL_CARDS )); then input_files_ordered+=("${idx4}.png"); fi
  if (( idx3 <= TOTAL_CARDS )); then input_files_ordered+=("${idx3}.png"); fi

  # Convert array to space-separated string for montage command
  input_files_str="${input_files_ordered[@]}"

  # Define the output file name for the current sheet
  output_file="back_sheet_${sheet_num}.png"

  # Determine the actual card range being processed for logging
  start_card_actual=$idx1
  end_card_actual=$(( idx1 + ${#input_files_ordered[@]} - 1 )) # Find the highest index actually used

  echo "Processing sheet $sheet_num (Cards $start_card_actual to $end_card_actual)..."
  echo "Montage input order: $input_files_str"

  # Skip if no input files (should not happen with valid TOTAL_CARDS > 0)
  if [ -z "$input_files_str" ]; then
      echo "Warning: No input files found for sheet $sheet_num, skipping."
      continue
  fi

  # Use ImageMagick's montage command
  montage \
    $input_files_str \
    -tile 2x2 \
    -geometry +${PADDING}+${PADDING} \
    -background white \
    -bordercolor white \
    -border ${MARGIN}x${MARGIN} \
    -density 300 \
    $output_file

  echo "Sheet $sheet_num saved to $output_file"
done

echo "Done. All sheets generated."
