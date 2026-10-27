# Harry, 27 Oct 2026 — adopt Leo's clip compression

Harry: "this patch notes from Leo has some stuff that will be useful let's adopt it … the clips one is good" (answer: "Leo's clip compression").
Leo's commit e5aedcbd re-compressed 0.119/0.121/0.123 clips 29.1 → 15.5 MB at CRF 30 because the patch-notes folder ships inside admin routes capped at 250 MB each by Vercel and one deploy failed.
Adopted as scripts/patch-notes/squeeze-media.sh; first run on every Harry note: 13.0 → 10.8 MB.
