# Red apple. Loaded by cuts2.py / cuts3.py when XCUTS_FOOD=apple (render_all.py --food apple).
# A food file may set: L, RM, EH, rad(x), CZ_A, CZ_B, STONE, YAW, LOOK (any keys), EXTRAS(rig).
# Local axes: X across the board (length L), Y depth (front = -Y), Z up. Cross-sections are
# ellipses: half-width rad(x), half-height rad(x)*EH, centred at height CZ_A*rad(x)+CZ_B.

L,RM,EH=2.5,1.12,0.88        # a round apple, a little wider than tall
def rad(x):
  u=2*x/L
  if abs(u)>=1: return 0.0
  return RM*(1-u*u)**0.42    # fuller "shoulders" than a perfect sphere
CZ_A,CZ_B=0.0,0.97*RM*EH     # every slice centred at the same height: rests on its middle
STONE=(0.0,0.0,0.97*RM*EH,0.26,0.30,0.62)   # the core: tall and narrow, under the stem
YAW=-0.25

LOOK.update(
  ramp=[(0.0,(0.24,0.008,0.008)),(0.17,(0.86,0.78,0.52)),(0.012,(0.50,0.05,0.03)),(0.035,(0.82,0.72,0.45))],  # thin red skin, cream flesh
  core=(0.70,0.58,0.32),core_ring=(0.36,0.20,0.06),skin_out=(0.34,0.02,0.015),
  skin_dark=(0.20,0.006,0.006),skin_light=(0.52,0.035,0.02),pores=140,bump=0.04,rough=0.3,coat=0.6,
  line_skin=(0.92,0.50,0.36),line_face=(0.55,0.42,0.22),
  pile={1:(0.15,(0.95,0.87,0.60)),2:(0.25,(0.93,0.85,0.58)),3:(0.4,(0.92,0.84,0.56)),4:(0.75,(1.0,0.93,0.66)),5:(0.85,(1.0,0.95,0.70))},
  glow={1:0.3,2:0.18,3:0.18,4:0.22,5:0.25},
  tip=0.5,          # wide slices: tip them less in round 1 or they knock the row in front into the air
  pile_floor=1.4)   # bigger pieces: keep the mound's bottom out of the board

def EXTRAS(rig):
  """a short brown stem on top, leaning a little"""
  bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=0.045,depth=0.42,location=(0.03,0.02,2*RM*EH+0.12),rotation=(0.18,0.22,0))
  st=bpy.context.object;st.name='stem';st.data.materials.append(plain('stem',(0.16,0.09,0.04),0.7))
  st.parent=rig;return [st]
