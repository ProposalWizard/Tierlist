"""Render "Which ball breaks all 20 layers?" on a computer with a graphics card.
  python render_layers.py --blender "<path to Blender 4.1>"            (full video, about 61 s)
  python render_layers.py --blender "<path to Blender 4.1>" --test     (rounds 1, 7 and 16 only)
Needs Blender 4.1 (not 4.2+), Python 3 with numpy + Pillow, ffmpeg. Output: out/layers_full.mp4
Stops if the sync check fails for any round."""
import argparse, os, subprocess, sys, time, json
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'out')
ap=argparse.ArgumentParser();ap.add_argument('--blender',required=True);ap.add_argument('--test',action='store_true');ap.add_argument('--workers',type=int,default=1);a=ap.parse_args()
os.makedirs(OUT,exist_ok=True);P=json.load(open(os.path.join(HERE,'plan_layers.json')));rounds=[0,6,15] if a.test else list(range(len(P['rounds'])))
t0=time.time()
for i in rounds:
  print(f'build + check round {i+1}: {P["rounds"][i]["name"]}')
  subprocess.run([a.blender,'-b','--factory-startup','--python',os.path.join(HERE,'layers.py'),'--','build',str(i)],capture_output=True,cwd=HERE)
  r=subprocess.run([a.blender,'-b','--factory-startup','--python',os.path.join(HERE,'layers.py'),'--','check',str(i)],capture_output=True,text=True,cwd=HERE)
  if 'CHECK PASS' not in r.stdout: print('STOP: sync check failed\n',r.stdout[-3000:]);sys.exit(1)
print('render');procs=[]
for i in rounds:
  m=json.load(open(os.path.join(OUT,f'meta_r{i:02d}.json')))
  procs.append(subprocess.Popen([a.blender,'-b',os.path.join(OUT,f'layers_r{i:02d}.blend'),'--python',os.path.join(HERE,'layers.py'),'--','render',str(i),str(m['F0']),str(m['F1'])],cwd=HERE,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL))
  while sum(p.poll() is None for p in procs)>=a.workers: time.sleep(2)
for p in procs: p.wait()
if a.test:
  print('test render done: frames are in out/fr (rounds 1, 7, 16).',round((time.time()-t0)/60,1),'min');sys.exit(0)
print('labels + sound');subprocess.run([sys.executable,os.path.join(HERE,'finish_layers.py')],check=True,cwd=HERE)
subprocess.run(['ffmpeg','-y','-v','error','-framerate','30','-i',os.path.join(OUT,'final','f%05d.jpg'),'-i',os.path.join(OUT,'audio_layers.wav'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',os.path.join(OUT,'layers_full.mp4')],check=True)
print('DONE:',os.path.join(OUT,'layers_full.mp4'),round((time.time()-t0)/60,1),'min')
