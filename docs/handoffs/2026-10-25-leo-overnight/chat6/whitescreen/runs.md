# White-screen hunt: season end, 10 runs (25 Oct 2026)

Build: production, http://localhost:3500, branch leo-season-end, update switch ON, 390x844 (iPhone 13 profile), headless Chromium 1194 (SwiftShader).

Each step: tap, then DOM probe every ~120 ms for 2.3 s, JPEG at ~300 ms and ~2 s. Blank = no text AND no visible canvas/svg/img/video/button (probe every 40 ms inside the page). Pixel mean RGB of the stills is in the last column (white would be ~255,255,255; the brightest still in all 10 runs had a min-channel mean of 61).

**Result: 0 of 10 runs showed a blank or white screen at any step.** The only DOM-empty spans were the first load/reload before React hydrates (page body background is already rgb(3,7,18), dark; stills taken right after navigation commit are 4,8,17).


## Run 1: skip

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 15,82,45 / 40,39,31 |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 14,50,56 / 36,84,106 |
| 3 | SKIP | SEASON 1 BALLON D'OR THE DOORS OPEN TAKING YOUR SEATS… SKIP › | no / no (empty 0 ms) | 61 | 2 JS files | 25,23,19 / - |
| 4 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 2 JS files | 47,106,56 / 47,106,57 |
| 5 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,39 / 80,72,37 |
| 6 | ✕ STAY | 2026/27 SEASON AWARDS 2026/27 THE SEASON AWARDS SKIP ALL SKIP › | no / no (empty 0 ms) | 63 | 1 JS files | 55,35,23 / - |
| 7 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | - | 52,124,69 / 54,113,62 |
| 8 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | - | 24,65,50 / 24,65,50 |
| 9 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT Knocking on his door… ROBER | no / no (empty 0 ms) | 1050 | 3 JS files | 69,79,60 / - |

DOM-empty spans: 789 ms at t=967 ms, url /star-dev, readyState interactive, body bg rgb(3, 7, 18)

Console/page errors: 10 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.


## Run 2: skip

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 15,82,45 / - |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 15,51,57 / 36,84,106 |
| 3 | SKIP | SEASON 1 BALLON D'OR SKIP › | no / no (empty 0 ms) | 27 | 2 JS files | 26,23,19 / - |
| 4 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 2 JS files | 47,106,57 / - |
| 5 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,38 / 80,72,37 |
| 6 | ✕ STAY | 2026/27 SEASON AWARDS 2026/27 THE SEASON AWARDS SKIP ALL SKIP › | no / no (empty 0 ms) | 63 | 1 JS files | 55,35,24 / - |
| 7 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | - | 53,119,66 / 54,113,62 |
| 8 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | - | 24,65,50 / 24,65,50 |
| 9 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT Knocking on his door… ROBER | no / no (empty 0 ms) | 1050 | 3 JS files | 69,79,60 / - |

DOM-empty spans: 576 ms at t=738 ms, url /star-dev, readyState interactive, body bg rgb(3, 7, 18)

Console/page errors: 10 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.


## Run 3: skip

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 15,82,45 / - |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 15,52,59 / 36,84,106 |
| 3 | SKIP | SEASON 1 BALLON D'OR SKIP › | no / no (empty 0 ms) | 27 | 2 JS files | 26,23,19 / - |
| 4 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 2 JS files | 47,106,57 / 47,106,57 |
| 5 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,38 / 80,72,37 |
| 6 | ✕ STAY | 2026/27 SEASON AWARDS 2026/27 THE SEASON AWARDS SKIP ALL SKIP › | no / no (empty 0 ms) | 63 | 1 JS files | 54,35,23 / - |
| 7 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | - | 52,124,69 / 54,113,62 |
| 8 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | - | 24,65,50 / 24,65,50 |
| 9 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT Knocking on his door… ROBER | no / no (empty 0 ms) | 1050 | 3 JS files | 69,79,60 / - |

DOM-empty spans: 679 ms at t=851 ms, url /star-dev, readyState loading, body bg rgb(3, 7, 18)

Console/page errors: 10 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.


## Run 4: skip

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 15,82,45 / 40,39,31 |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 13,44,44 / 36,84,106 |
| 3 | SKIP | SEASON 1 BALLON D'OR SKIP › | no / no (empty 0 ms) | 27 | 2 JS files | 25,23,19 / - |
| 4 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 2 JS files | 47,106,57 / - |
| 5 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,38 / 80,72,37 |
| 6 | ✕ STAY | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 72 | 1 JS files | 54,35,23 / - |
| 7 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | - | 51,126,70 / 54,113,62 |
| 8 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | - | 24,65,50 / 24,65,50 |
| 9 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT ROBERTO HOBBS Diego Doherty | no / no (empty 0 ms) | 1050 | 3 JS files | 69,79,60 / - |

DOM-empty spans: 920 ms at t=1150 ms, url /star-dev, readyState loading, body bg rgb(3, 7, 18)

Console/page errors: 10 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.


## Run 5: play (reel + awards night played fully)

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 15,82,45 / 40,39,31 |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 14,48,53 / 36,84,106 |
| 3 | CONTINUE | SEASON 1 BALLON D'OR SKIP › | no / no (empty 0 ms) | 27 | 2 JS files | 25,23,19 / - |
| 4 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 2 JS files | 47,106,56 / - |
| 5 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,38 / 80,72,37 |
| 6 | ✕ STAY | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 72 | 1 JS files | 54,35,23 / - |
| 7 | CONTINUE › | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | - | 53,118,66 / 54,113,62 |
| 8 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | - | 24,65,50 / 24,65,50 |
| 9 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT Knocking on his door… ROBER | no / no (empty 0 ms) | 1050 | 3 JS files | 69,79,60 / - |

DOM-empty spans: 522 ms at t=692 ms, url /star-dev, readyState loading, body bg rgb(3, 7, 18)

Console/page errors: 14 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.


## Run 6: play (reel + awards night played fully)

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 15,82,45 / 41,39,31 |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 16,56,67 / 36,84,106 |
| 3 | CONTINUE | SEASON 1 BALLON D'OR THE DOORS OPEN TAKING YOUR SEATS… SKIP › | no / no (empty 0 ms) | 61 | 3 JS files | 26,23,19 / - |
| 4 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 2 JS files | 47,106,56 / 47,106,57 |
| 5 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,38 / 80,72,37 |
| 6 | ✕ STAY | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 72 | 1 JS files | 55,35,23 / - |
| 7 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | - | 24,65,50 / 24,65,50 |
| 8 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT Knocking on his door… ROBER | no / no (empty 0 ms) | 1050 | 3 JS files | 69,79,60 / - |

DOM-empty spans: 732 ms at t=923 ms, url /star-dev, readyState loading, body bg rgb(3, 7, 18)

Console/page errors: 14 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.


## Run 7: skip + reload during awards night

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 15,82,45 / 40,39,31 |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 13,45,48 / 36,84,106 |
| 3 | SKIP | SEASON 1 BALLON D'OR THE DOORS OPEN TAKING YOUR SEATS… SKIP › | no / no (empty 0 ms) | 61 | 2 JS files | 26,23,19 / - |
| 4 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 2 JS files | 47,106,56 / 47,106,57 |
| 5 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,38 / 80,72,37 |
| 6 | ✕ STAY | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 72 | 1 JS files | 55,36,24 / - |
| 7 | reload | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 0 | 3 JS files | 25,16,13 / - |
| 8 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | 3 JS files | 55,113,63 / 54,113,62 |
| 9 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | 3 JS files | 24,65,50 / 24,65,50 |
| 10 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT Knocking on his door… ROBER | no / no (empty 0 ms) | 1050 | 3 JS files | 69,79,60 / - |

DOM-empty spans: 686 ms at t=883 ms, url /star-dev, readyState loading, body bg rgb(3, 7, 18); 45 ms at t=25108 ms, url /star-dev, readyState complete, body bg rgb(3, 7, 18)

Console/page errors: 17 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.


## Run 8: skip + reload during awards night

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 15,82,45 / 40,39,31 |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 13,44,44 / 36,84,106 |
| 3 | SKIP | SEASON 1 BALLON D'OR SKIP › | no / no (empty 0 ms) | 27 | 2 JS files | 25,23,19 / - |
| 4 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 2 JS files | 47,106,57 / 47,106,57 |
| 5 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,38 / 80,72,37 |
| 6 | ✕ STAY | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 72 | 1 JS files | 53,34,22 / - |
| 7 | reload | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 0 | 3 JS files | 25,16,13 / - |
| 8 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | 3 JS files | 55,113,63 / 54,113,62 |
| 9 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | 3 JS files | 24,65,50 / 24,65,50 |
| 10 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT Knocking on his door… ROBER | no / no (empty 0 ms) | 1050 | 3 JS files | 69,79,60 / - |

DOM-empty spans: 707 ms at t=912 ms, url /star-dev, readyState loading, body bg rgb(3, 7, 18); 57 ms at t=27297 ms, url /star-dev, readyState complete, body bg rgb(3, 7, 18)

Console/page errors: 17 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.


## Run 9: skip + reload on reel + reload on awards page

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 15,82,45 / 40,39,31 |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 15,52,60 / 36,84,106 |
| 3 | reload | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 10,31,18 / 36,84,105 |
| 4 | SKIP | SEASON 1 BALLON D'OR THE DOORS OPEN TAKING YOUR SEATS… SKIP › | no / no (empty 0 ms) | 61 | 3 JS files | 25,23,19 / - |
| 5 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 3 JS files | 47,106,56 / 47,106,56 |
| 6 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,38 / 80,72,37 |
| 7 | ✕ STAY | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 72 | 1 JS files | 53,34,22 / - |
| 8 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | - | 54,113,62 / 54,113,62 |
| 9 | reload | 2026/27 SEASON AWARDS 2026/27 THE SEASON AWARDS SKIP ALL SKIP › | no / no (empty 0 ms) | 0 | 3 JS files | 25,15,12 / 57,38,26 |
| 10 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | 3 JS files | 54,113,62 / 54,113,62 |
| 11 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | 3 JS files | 24,65,50 / 24,65,50 |
| 12 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT Knocking on his door… ROBER | no / no (empty 0 ms) | 1050 | 3 JS files | 28,48,39 / - |

DOM-empty spans: 891 ms at t=1046 ms, url /star-dev, readyState interactive, body bg rgb(3, 7, 18); 158 ms at t=9508 ms, url /star-dev, readyState loading, body bg rgb(3, 7, 18); 45 ms at t=29487 ms, url /star-dev, readyState complete, body bg rgb(3, 7, 18)

Console/page errors: 24 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.


## Run 10: skip + reload on reel + reload on awards page

| step | action tapped | on screen after tap (2 s) | blank at 300 ms / 2 s | min text length | JS chunks fetched | still mean RGB (300ms / 2s) |
|---|---|---|---|---|---|---|
| 1 | goto | TEST STRIKER AGE 16 ★ 1k ? 1 58 ST STRIKER 40 PAC 40 POW 40 TEC 40 VIS | no / no (empty 0 ms) | 0 | 3 JS files | 28,46,34 / 41,39,31 |
| 2 | 🏆 End of Season | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 14,49,55 / 36,84,106 |
| 3 | reload | SKIP SAVE VIDEO CONTINUE | no / no (empty 0 ms) | 0 | 3 JS files | 10,31,18 / 36,84,105 |
| 4 | SKIP | SEASON 1 BALLON D'OR THE DOORS OPEN TAKING YOUR SEATS… SKIP › | no / no (empty 0 ms) | 61 | 3 JS files | 24,22,19 / - |
| 5 | SKIP › | 💪 Not Nominated Trophies, goals and a big season next time. WINNER Rod | no / no (empty 0 ms) | 387 | 3 JS files | 47,106,56 / 47,106,56 |
| 6 | CONTINUE TO NEXT SEASON → | TRANSFERS SEASON 1 · SUMMER WINDOW TRANSFER WINDOW 73 clubs want you B | no / no (empty 0 ms) | 344 | - | 80,72,39 / 80,72,37 |
| 7 | ✕ STAY | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 72 | 1 JS files | 55,35,23 / - |
| 8 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | - | 54,113,62 / 54,113,62 |
| 9 | reload | 2026/27 SEASON AWARDS THE DOORS OPEN FINDING YOUR TABLE… SKIP ALL SKIP | no / no (empty 0 ms) | 0 | 3 JS files | 25,15,13 / - |
| 10 | SKIP ALL | SEASON 1 SEASON AWARDS TROPHIES NATIONAL LEAGUE YE Yeovil FA CUP AR Ar | no / no (empty 0 ms) | 894 | 3 JS files | 54,113,62 / 54,113,62 |
| 11 | CONTINUE | SEASON REVIEW The divisions have changed PLAY-OFF FINAL BO Boston 1–3  | no / no (empty 0 ms) | 750 | 3 JS files | 24,65,50 / 24,65,50 |
| 12 | CONTINUE | TEST STRIKER AGE 17 ★ 1k ? 1 IN THE DUGOUT Knocking on his door… ROBER | no / no (empty 0 ms) | 1050 | 3 JS files | 69,79,60 / - |

DOM-empty spans: 562 ms at t=801 ms, url /star-dev, readyState loading, body bg rgb(3, 7, 18); 18 ms at t=10124 ms, url /star-dev, readyState complete, body bg rgb(3, 7, 18); 164 ms at t=29847 ms, url /star-dev, readyState loading, body bg rgb(3, 7, 18)

Console/page errors: 24 console lines (all 'Failed to load resource' 500/404/tunnel + club_logos fetch), 0 pageerrors.

## What the checks found

- 0 of 10 runs went blank or white. Brightest still of 170 had a min-channel mean of 61 (white is about 255). Stills from the instant a navigation commits (nav/k0-0.jpg, 3 of 3 loads) are 4,8,17: the dark page colour, not white.
- DOM-empty spans (no text and no visible canvas/button/img/svg for at least one 40 ms tick): only the first load (522 to 920 ms, before React hydrates) and the reloads in runs 7 to 10 (18 to 164 ms; 45 to 57 ms on awards-night reloads). Body background was rgb(3, 7, 18) in every one.
- Reload during the awards night (runs 7, 8) and on the awards page (runs 9, 10) both resume the awards NIGHT from its start (page.tsx:2676), not the awards page.
- Reel plays to its end in under 2.3 s here because no goal clips exist in IndexedDB (runs 5, 6 tapped Continue at once); awards night played in full in run 5 (Continue appeared) and ended by itself in run 6.
- Errors: no page errors in any run. Console: 500s from /api/star/lineups, /api/star/league-squads, /api/draft/roster, /api/star/cutscene-edits (Supabase unreachable from the sandbox, so squads are invented) and ERR_TUNNEL_CONNECTION_FAILED / club_logos fetch failed (proxy). Not related to the season end.
- Save: snap taken at "End of Season" button (Season 1, week after the dev skip "End of this season"; "2 weeks before" + simulating by hand was replaced by the dev skip), 6 goalLog rows added, career.unlocks deleted, switch {"on":true,"off":[]}. Every run ended on season 2, age 17.
