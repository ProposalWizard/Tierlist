# Cut-scene music

`make_beds.py` writes the five cut-scene music beds
(`public/sfx/cut-music-{signing,trophy,walkout,press,farewell}.mp3`) from notes
written in the file, played by a small numpy synthesiser (piano, strings,
brass, timpani, toms, a drone, a simple reverb). Each file loops seamlessly.

    python3 tools/cutscene-music/make_beds.py           # all five
    python3 tools/cutscene-music/make_beds.py farewell  # one

Needs python3 with numpy, scipy and av (PyAV with libmp3lame). About 30 s.
The game plays them through `lib/star/cutscene/music.ts`; any of them can be
replaced on the Sound Board without a deploy. Licence:
`public/sfx/CUTSCENE-MUSIC-LICENSE.txt`.
