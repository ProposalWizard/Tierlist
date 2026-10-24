set -e
cd /home/user/Tierlist
python3 tools/mocap3d/build.py --cmu /nonexistent --only knee_slide --out ${SCRATCH:?set SCRATCH to a scratch folder}/build | grep -E "keyed|slide \("
cp ${SCRATCH:?set SCRATCH to a scratch folder}/build/mocap.glb ${SCRATCH:?set SCRATCH to a scratch folder}/build/mocap.ks.glb
SHRINK_TOOLS=${SCRATCH:?set SCRATCH to a scratch folder}/tools npx tsx tools/motionref/settle_clips.mts ${SCRATCH:?set SCRATCH to a scratch folder}/build/mocap.ks.glb | grep knee_slide
cd ${SCRATCH:?set SCRATCH to a scratch folder}/tools
node splice.mjs ${SCRATCH:?set SCRATCH to a scratch folder}/mocap.orig.glb ../build/mocap.ks.glb /home/user/Tierlist/public/star/anims3d/mocap.glb knee_slide
node splice.mjs ${SCRATCH:?set SCRATCH to a scratch folder}/mocap-ual.orig.glb ../build/mocap-ual.glb /home/user/Tierlist/public/star/anims3d/mocap-ual.glb knee_slide
cd /home/user/Tierlist
node scripts/perf3d/shrink-models.mjs --tools=${SCRATCH:?set SCRATCH to a scratch folder}/tools star/anims3d/mocap.glb star/anims3d/mocap-ual.glb | tail -1
cd ${SCRATCH:?set SCRATCH to a scratch folder}/tools
for f in mocap mocap-ual; do node dump.mjs /home/user/Tierlist/public/star/anims3d/$f.glb ../$f.after.json >/dev/null; echo "== $f"; node cmp2.mjs ../$f.before.json ../$f.after.json | head -3; done
