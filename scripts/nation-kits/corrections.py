"""Fixes made by eye, after looking at every kit picture (sheet_*.png).
C(nation, side, pattern words, trim=hex, shirt=word, shirtHex=hex, trimWord=word)."""
import json
CORR = {}
def C(nation, side, pattern=None, trim=None, shirt=None, shirtHex=None, trimWord=None, note=None, sleevesHex=None, shortsHex=None, socksHex=None, shorts=None, socks=None):
    d = CORR.setdefault(nation, {}).setdefault(side, {})
    if pattern: d["pattern"] = pattern
    if trim: d["trimHex"] = trim
    if trimWord: d["trim"] = trimWord
    if shirt: d["shirt"] = shirt
    if shirtHex: d["shirtHex"] = shirtHex
    for k2, v in (("sleevesHex", sleevesHex), ("shortsHex", shortsHex), ("socksHex", socksHex), ("shorts", shorts), ("socks", socks)):
        if v: d[k2] = v
    d["note"] = note or "pattern words set by eye from the kit picture"
NAVY, WHITE, BLACK, RED, GOLD, GREEN, SKY = "#001F5B", "#F2F4F7", "#17181A", "#D71920", "#D4A72C", "#159C56", "#75AADB"
# ── sheet: first nations ─────────────────────────────────────────────────
C("Spain", "home", "Red with navy sleeves and thin gold stripes", trim=NAVY)
C("Argentina", "home", "White and sky blue stripes", trim=SKY, trimWord="Sky Blue")
C("Argentina", "away", "Black with a purple and blue graphic pattern")
C("Brazil", "home", "Yellow with green trim", trim="#006060", trimWord="Green")
C("Brazil", "away", "Navy with a blue graphic pattern", shirt="Navy", shirtHex="#1B2A5C", trim="#4A7BD0", trimWord="Blue")
C("Portugal", "home", "Red with green trim", trim="#006600", trimWord="Green")
C("Germany", "home", "White with a black, red and gold chevron across the chest", trim=BLACK, trimWord="Black")
C("Germany", "away", "Navy with small turquoise motifs and turquoise trim", shirt="Navy", shirtHex="#0A1A2E")
C("Croatia", "home", "Red and white checks", trim=RED, trimWord="Red")
C("Côte d'Ivoire", "away", "White with an orange floral graphic pattern", trim="#F07A1E", trimWord="Orange")
C("Poland", "away", "Red with a dark red graphic pattern")
C("Scotland", "home", "Navy", trim=WHITE, trimWord="White")
C("Scotland", "away", "Red with thin claret stripes")
C("Peru", "home", "White with a red sash", trim=RED, trimWord="Red")
C("Peru", "away", "Black with gold trim", trim=GOLD, trimWord="Gold")
C("Jamaica", "home", "Yellow with a black and green pattern across the chest")
C("Jamaica", "away", "Black with a green and gold graphic pattern")
C("Jordan", "home", "White with red trim", trim=RED, trimWord="Red")
C("Jordan", "away", "Red with white trim", trim=WHITE, trimWord="White")
C("Curaçao", "home", "Royal blue with yellow trim", trim="#FBE300", trimWord="Yellow")
C("Sudan", "home", "Red with a black and green stripe across the chest", trim=BLACK, trimWord="Black")
C("Kuwait", "away", "Cream with navy trim", shirt="Cream")
exec(open("corrections_list.py").read())
if __name__ == "__main__":
    json.dump(CORR, open("corrections.json", "w"), indent=1, ensure_ascii=False)
    print(len(CORR), "nations corrected")
