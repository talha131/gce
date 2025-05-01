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
  # Calculate starting card number for this sheet
  start_card=$(( (sheet_num - 1) * CARDS_PER_SHEET + 1 ))
  # Calculate ending card number for this sheet
  end_card=$(( sheet_num * CARDS_PER_SHEET ))
  # Adjust end_card if it exceeds the total number of cards
  if (( end_card > TOTAL_CARDS )); then
    end_card=$TOTAL_CARDS
  fi

  # Build the list of input files for the current sheet
  input_files=""
  for (( card_index=start_card; card_index<=end_card; card_index++ )); do
    input_files+=" card_${card_index}.png"
  done

  # Define the output file name for the current sheet
  output_file="front_sheet_${sheet_num}.png"

  echo "Processing sheet $sheet_num (Cards $start_card to $end_card)..."

  # Use ImageMagick's montage command
  montage \
    $input_files \
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
