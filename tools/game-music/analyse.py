import sys, glob, os, json, numpy as np, librosa
MAJ=np.array([6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88]);MIN=np.array([6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17])
N=['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B']
out={}
for f in sorted(glob.glob(sys.argv[1]+'/*.mp3'), key=lambda p: os.path.basename(p).split('-',1)[1]):
    name=os.path.basename(f).split('-',1)[1][:-4]
    y,sr=librosa.load(f,sr=22050,mono=True)
    tempo,beats=librosa.beat.beat_track(y=y,sr=sr)
    h,p=librosa.effects.hpss(y)
    ch=librosa.feature.chroma_cqt(y=h,sr=sr).mean(1)
    best=max(((np.corrcoef(np.roll(t,k),ch)[0,1],N[k]+(' major' if m else ' minor')) for m,t in((1,MAJ),(0,MIN)) for k in range(12)))
    rms=librosa.feature.rms(y=y)[0]; t=librosa.times_like(rms,sr=sr)
    secs=int(len(y)/sr); seg=[float(np.mean(rms[(t>=s)&(t<s+10)])) for s in range(0,secs,10)]
    mx=max(seg); curve=''.join(' ▁▂▃▄▅▆▇█'[min(8,int(v/mx*8))] for v in seg)
    cent=float(librosa.feature.spectral_centroid(y=y,sr=sr).mean())
    perc=float(np.sum(p**2)/(np.sum(h**2)+np.sum(p**2)))
    ons=len(librosa.onset.onset_detect(y=y,sr=sr))/secs
    # low vs high energy share
    S=np.abs(librosa.stft(y))**2; fr=librosa.fft_frequencies(sr=sr)
    low=float(S[fr<200].sum()/S.sum())
    out[name]=dict(len=secs,bpm=round(float(np.atleast_1d(tempo)[0]),1),key=best[1],keyfit=round(best[0],2),curve=curve,brightHz=round(cent),drums=round(perc,2),hitsPerSec=round(ons,1),bass=round(low,2))
    print(f"{name[:38]:38} {secs:4}s {out[name]['bpm']:6} bpm {best[1]:9} fit {best[0]:.2f} | {curve} | bright {cent:5.0f}Hz drums {perc:.2f} hits/s {ons:.1f} bass {low:.2f}",flush=True)
json.dump(out,open(os.path.dirname(__file__)+'/analysis.json','w'),indent=1)
