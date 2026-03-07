-- Fix duplicate artist names in Supabase database
-- Date: March 7, 2026
-- Purpose: Update artist names that have case variations

-- 1. Update TATTOO COLOUR to Tattoo Colour
UPDATE band_songs 
SET artist = 'Tattoo Colour' 
WHERE artist = 'TATTOO COLOUR';

-- 2. Update Colorpitch to COLORPiTCH
UPDATE band_songs 
SET artist = 'COLORPiTCH' 
WHERE artist = 'Colorpitch';

-- 3. Verify changes
SELECT artist, COUNT(*) as song_count
FROM band_songs
WHERE artist IN ('Tattoo Colour', 'COLORPiTCH', 'TATTOO COLOUR', 'Colorpitch')
GROUP BY artist
ORDER BY artist;

-- Expected result after update:
-- Tattoo Colour: 3 songs
-- COLORPiTCH: 2 songs
-- (TATTOO COLOUR and Colorpitch should return 0 rows)
