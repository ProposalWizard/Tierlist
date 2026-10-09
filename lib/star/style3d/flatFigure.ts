/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * THE 2D LOOK'S PLAYERS — "fake 3D": a flat drawn footballer on a card that
 * always faces the camera, standing on the 3D pitch. No real faces (Harry:
 * "the fake 3d with no real player faces"): a plain head in skin tone, hair,
 * the shirt number on the back. Four running frames, a back and a front view.
 */

export interface FlatKit { shirt: string; shorts: string; socks: string; skin: string; hair: string; number?: number | null; gloves?: string }

const FW = 48, FH = 96;

function drawFigure(g: CanvasRenderingContext2D, k: FlatKit, view: "back" | "front", frame: number, still: boolean) {
  const ph = (frame / 4) * Math.PI * 2;
  const sw = still ? 0 : Math.sin(ph);
  const lift = still ? 0 : Math.max(0, Math.cos(ph));
  const lift2 = still ? 0 : Math.max(0, -Math.cos(ph));
  const bodyY = still ? 0 : -Math.abs(Math.sin(ph)) * 1.5;
  g.save();
  g.translate(0, bodyY);
  // legs (behind the shorts)
  const leg = (x: number, swing: number, up: number) => {
    const fx = x + swing * 5;
    g.fillStyle = k.skin; g.fillRect(fx - 3, 62, 6, 9 - up * 2);
    g.fillStyle = k.socks; g.fillRect(fx - 3.5, 70 - up * 2, 7, 13);
    g.fillStyle = "#16161c"; g.fillRect(fx - 4, 83 - up * 3, 9, 5);
  };
  leg(19, -sw, lift); leg(29, sw, lift2);
  // arms
  const arm = (x: number, swing: number) => {
    g.fillStyle = k.shirt; g.fillRect(x - 3.5, 31, 7, 9);
    g.fillStyle = k.gloves ?? k.skin;
    g.save(); g.translate(x, 38); g.rotate(swing * 0.5); g.fillRect(-2.5, 0, 5, 15); g.restore();
  };
  arm(10, sw); arm(38, -sw);
  // shorts and shirt
  g.fillStyle = k.shorts; g.fillRect(13, 54, 22, 12);
  g.fillStyle = k.shirt;
  g.beginPath(); g.moveTo(12, 31); g.lineTo(36, 31); g.lineTo(35, 57); g.lineTo(13, 57); g.closePath(); g.fill();
  // collar
  g.fillStyle = k.shorts; g.fillRect(19, 29, 10, 3);
  if (view === "back" && k.number != null) {
    const light = parseInt(k.shirt.slice(1, 3), 16) + parseInt(k.shirt.slice(3, 5), 16) + parseInt(k.shirt.slice(5, 7), 16) > 560;
    g.fillStyle = light ? "#1f2937" : "#ffffff";
    g.font = "bold 17px Arial"; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillText(String(k.number), 24, 45);
  }
  // head: plain, no face
  g.fillStyle = k.skin; g.fillRect(21, 25, 6, 6);
  g.beginPath(); g.arc(24, 19, 8.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = k.hair;
  g.beginPath();
  if (view === "back") g.arc(24, 18, 8.8, Math.PI * 0.95, Math.PI * 2.05);
  else g.arc(24, 17, 8.8, Math.PI * 1.05, Math.PI * 1.95);
  g.fill();
  if (view === "back") g.fillRect(15.5, 17, 17, 6);
  g.restore();
}

/** One figure: a sprite and its shadow. */
export class FlatFigure {
  sprite: any;
  shadow: any;
  private c: HTMLCanvasElement;
  private tmp: HTMLCanvasElement;
  private tex: any;
  private key = "";
  private phase = Math.random() * 4;

  constructor(private T: any, private k: FlatKit, private pixel: boolean, private outline: string, shadowMat: any) {
    const s = pixel ? 0.5 : 2;
    this.c = document.createElement("canvas");
    this.c.width = FW * s; this.c.height = FH * s;
    this.tmp = document.createElement("canvas");
    this.tmp.width = this.c.width; this.tmp.height = this.c.height;
    this.tex = new T.CanvasTexture(this.c);
    this.tex.colorSpace = T.SRGBColorSpace;
    if (pixel) { this.tex.minFilter = this.tex.magFilter = T.NearestFilter; this.tex.generateMipmaps = false; }
    this.sprite = new T.Sprite(new T.SpriteMaterial({ map: this.tex, alphaTest: 0.5, transparent: false }));
    this.sprite.center.set(0.5, 0.04);
    this.sprite.scale.set(1.05, 2.1, 1);
    this.shadow = new T.Mesh(new T.CircleGeometry(0.42, 16), shadowMat);
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.scale.set(1, 0.6, 1);
  }

  /** x, z: three coords; vx, vz: velocity; facingZ: < 0 means facing away from the camera (towards the goal). */
  set(x: number, z: number, vx: number, vz: number, facingZ: number, dt: number) {
    const sp = Math.hypot(vx, vz);
    const still = sp < 0.4;
    this.phase = (this.phase + dt * Math.min(9, 1.6 + sp * 1.1)) % 4;
    const frame = Math.floor(this.phase);
    const view = facingZ > 0.25 ? "front" : "back";
    const flip = vx < -0.2;
    const key = `${still ? "s" : frame}-${view}-${flip}`;
    if (key !== this.key) { this.key = key; this.draw(view, frame, still, flip); }
    this.sprite.position.set(x, 0, z);
    this.shadow.position.set(x + 0.15, 0.02, z + 0.1);
  }

  private draw(view: "back" | "front", frame: number, still: boolean, flip: boolean) {
    const s = this.c.width / FW;
    const t = this.tmp.getContext("2d")!;
    t.setTransform(1, 0, 0, 1, 0, 0);
    t.clearRect(0, 0, this.tmp.width, this.tmp.height);
    t.setTransform(flip ? -s : s, 0, 0, s, flip ? this.tmp.width : 0, 0);
    drawFigure(t, this.k, view, frame, still);
    const g = this.c.getContext("2d")!;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.c.width, this.c.height);
    // the outline: the figure's shape in the line colour, nudged round, then the figure
    g.save();
    const o = Math.max(1, s * 1.1);
    for (const [dx, dy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) g.drawImage(this.tmp, dx, dy);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = this.outline; g.fillRect(0, 0, this.c.width, this.c.height);
    g.restore();
    g.drawImage(this.tmp, 0, 0);
    this.tex.needsUpdate = true;
  }

  dispose() { this.tex.dispose(); this.sprite.material.dispose(); this.shadow.geometry.dispose(); }
}
