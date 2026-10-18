import json,re,html
rows=json.load(open('rows.json'))
NAME={
"/admin/patch-notes":"Patch notes","/admin/app-plan":"App plan","/admin/testers":"Tester access","/admin/xp":"Site XP rewards",
"/admin/football":"Tic Tac Toe data","/profile-new":"New profile (trial)","/squad-builder":"Dream XI builder","/admin":"Site content",
"/admin/football/players":"SoFIFA players","/admin/football/pl-clubs":"PL clubs per season","/admin/football/scrape":"Scrape / import",
"/draft-dev":"Draft test","/draft-dev2":"Draft test 2","/draft-challenge-dev":"Challenge draft","/admin/cl-draft":"Champions League draft",
"/draft/preview":"Draft design preview","/draft/american":"American draft sandbox","/star-dev":"Play the game",
"/star-retirement-dev":"Retirement screens","/star-relgames-dev":"Relationship games","/star-goal-clips-dev":"Goal videos",
"/star-dev/media-lab":"Media lab","/star-training-dev":"Training levels","/star-gallery-dev":"Scenario gallery",
"/star-highlights-dev":"Infinite Highlights","/star-play-dev":"Play Area","/star-scenario-dev":"Scenario Builder page",
"/star-update-dev":"Leo's Oct 13 update","/star-sim90-dev":"Full match","/star-radar-dev":"Match radar","/star-dribble-dev":"First-person dribble",
"/star-dribble-stick-dev":"Dribble on a stick","/star-bigger-dev":"Bigger players","/star-match-dev":"Match Dev (engine copy)",
"/star-sound-lab-dev":"Sound lab","/star-real-moments-dev":"Real moments","/star-statsbomb-dev":"Real shots","/star-intl-dev":"International world",
"/star-tournament-dev":"Tournaments","/lineups":"Team sheets","/admin/clubs":"Club data","/admin/badges":"Club badges","/admin/custom-clubs":"Custom clubs",
"/star-3d-area-dev":"3D test area","/star-3d-area-dev/signing":"3D signing","/star-3d-area-dev/office":"Manager's office",
"/star-shop3d-dev":"3D shop","/star-garden3d-dev":"3D garden","/star-home3d-dev":"3D house","/star-training3d-dev":"3D training",
"/star-style-dev":"Art styles + cut-scene director","/star-animations-dev":"2D animations","/star-anim3d-dev":"3D animations",
"/star-people-dev":"Cut-scene people","/star-look-dev":"Player style","/star-sprites-dev":"3D match figures","/admin/star-pass":"Star Pass",
"/admin/star-xp":"Career XP book","/star-store-dev":"Store test","/star-wallet-dev":"Gems test","/star-tuning-dev":"Balance numbers",
"/admin/sound-board":"Sound board","/star-attack-dev":"Live attack","/star-bicycle-dev":"Bicycle kick","/star-zoomgrass-dev":"Zoom-to-play camera",
"/star-3d-dev":"Old 3D skin","/star-spin-dev":"Spin your player","/star-blender-dev":"Blender footballer","/sfx-dev":"Sound manifest",
"/ballon-dor":"Ballon d'Or career (old beta)","/manager":"Manager mode"}
# fate defaults. (fate, why, decided-by-you)
DEC={"/star-match-dev":("del","You said: remove it now; git keeps it (LAG-QB10)."),
"/star-bigger-dev":("del","You said: delete; the look was decided 12 Oct (LAG-QB11)."),
"/star-zoomgrass-dev":("del","You said: delete; the look was decided 12 Oct (LAG-QB11)."),
"/star-scenario-dev":("del","You said: delete; the same tool is a gallery tab (LAG-QB13)."),
"/admin/cl-draft":("old","You said no to keeping it (ADM-Q42)."),
"/draft-dev2":("del","Becomes a redirect to Draft test (ADM-Q68 / LAG-QB9)."),
"/manager":("old","You said manager mode is not live any more (LAG-QB14)."),}
REC={ # my recommendation for the old tests you said you decide yourself (LAG-QB12)
"/star-3d-dev":("del","The old 3D skin. Players are 3D-made sprites now (12 Oct)."),
"/star-spin-dev":("del","The 3D player in the shop replaced it."),
"/star-blender-dev":("del","3D people replaced it."),
"/star-look-dev":("del","Player style New was decided 12 Oct."),
"/sfx-dev":("del","Sound board and Sound lab do this and more."),
"/star-attack-dev":("del","A 6 Sep prototype. It is also one of the 4 engine copies the build guard lists."),
"/star-bicycle-dev":("del","A throwaway test. It is also one of the 4 engine copies the build guard lists."),
"/star-sprites-dev":("old","Still the only page that shows every baked match figure."),
"/profile-new":("old","A profile redesign nobody has finished deciding on."),
"/draft/preview":("old","Draft screen redesigns, sample data only."),
"/draft/american":("old","The real American mode is inside Draft rooms now."),
"/squad-builder":("old","A Dream XI game is on the future list."),
"/ballon-dor":("old","An older separate game. Same name as the real one, so it is renamed."),}
GROUPS=[("RBD","Career screens"),("RBD","Chances"),("RBD","Match tests"),("RBD","Real data"),("RBD","3D places"),
("RBD","Players + animation"),("RBD","Money + rewards"),("RBD","Sound"),("Site",""),("PL Draft",""),("Tierlists",""),("Old","Old tests")]
pages=[]
for r in rows:
    url,what,owner,writes,lnew,home,fate=r[1],r[2],r[3],r[4],r[7],r[9],r[10]
    o=owner.split(" ")[0]
    if o.startswith("?") or "guess" in owner: o="Harry"   # ADM-Q3: Harry put these in
    o=o.rstrip("?")
    if url=="/star-dev":o="All"
    if url=="/admin/patch-notes":o="Shared"
    if url=="/star-spin-dev":o="Mikey + Harry"
    home=home.replace(" (+RBD Real data)","")
    if url=="/draft-dev2":home="PL Draft"
    if home.startswith("RBD › "):sec,grp="RBD",home[6:]
    elif home=="Old tests":sec,grp="Old","Old tests"
    else:sec,grp=home,""
    lock={"A":"Admins","T":"Admins + testers","open":"Everyone"}[lnew]
    f="keep"; why=""; you=False
    if url in DEC: f,why=DEC[url]; you=True
    elif url in REC: f,why=REC[url]
    elif home=="Old tests": f="old"
    if f!="keep" and sec!="Old": sec,grp=("Old","Old tests")
    pages.append(dict(u=url,n=NAME[url],w=what,o=o,wr=writes,l=lock,s=sec,g=grp,f=f,why=why,you=you))
pages.append(dict(u="/manager",n="Manager mode",w="Old manager game mode",o="Mikey",wr="own",l="Admins + testers",s="Old",g="Old tests",f="old",why=DEC["/manager"][1],you=True))
json.dump(pages,open('pages.json','w'),indent=0)
from collections import Counter
print(Counter(p['f'] for p in pages), Counter(p['l'] for p in pages if p['f']!='del'), Counter(p['o'] for p in pages if p['f']=='keep'))
print(Counter((p['s'],p['g']) for p in pages))
