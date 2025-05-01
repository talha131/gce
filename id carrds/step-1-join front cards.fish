#!/usr/bin/env fish

# Simple fish script to combine pairs of images horizontally into card files.
# Assumes pairs like 1.png/2.png, 3.png/4.png exist up to MAX_IMAGE_NUMBER.
# Places the higher numbered image (e.g., 2.png) left, lower (e.g., 1.png) right.
# Output: card_1.png, card_2.png, ...

# Define the highest numbered image file you have. Must be an even number.
set MAX_IMAGE_NUMBER 136 # Adjust this as needed

# Calculate the total number of cards to generate.
set MAX_CARDS (math $MAX_IMAGE_NUMBER / 2)

echo "Generating $MAX_CARDS card files..."

for card_index in (seq 1 $MAX_CARDS)
    # Calculate the image numbers for the current card
    set lower_num (math 2 \* $card_index - 1)
    set higher_num (math 2 \* $card_index)

    # Define input and output filenames
    set file1 "$lower_num.png"  # Image for the right side
    set file2 "$higher_num.png" # Image for the left side
    set output_file "card_$card_index.png"

    echo "Combining $file2 (left) and $file1 (right) -> $output_file"
    # convert [image_left] [image_right] +append [output_file]
    convert $file2 $file1 +append $output_file
end

echo "Done. Created $MAX_CARDS card files."
