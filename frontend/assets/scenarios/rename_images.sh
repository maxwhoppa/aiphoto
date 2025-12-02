#!/bin/bash

cd /Users/maxwellnewman/aiphoto/frontend/assets/scenarios

for dir in */; do
  if [ -d "$dir" ]; then
    echo "Processing $dir"
    cd "$dir"
    counter=1

    # First, get all image files and sort them
    for file in $(ls *.jpg *.jpeg *.png *.JPG *.JPEG *.PNG 2>/dev/null | sort); do
      if [ -f "$file" ]; then
        # Get extension in lowercase
        ext="${file##*.}"
        ext=$(echo "$ext" | tr '[:upper:]' '[:lower:]')
        new_name="${counter}.${ext}"

        if [ "$file" != "$new_name" ]; then
          mv "$file" "$new_name"
          echo "  Renamed: $file -> $new_name"
        fi
        ((counter++))
      fi
    done

    cd ..
  fi
done

echo "Done renaming all images!"