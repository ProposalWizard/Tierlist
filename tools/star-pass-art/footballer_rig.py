"""Posing the MakeHuman footballer (build_footballer.py) by joint, in plain terms.

Every rotation is given in the character's own axes, relative to the bone's
parent, so a pose reads like a description ("left thigh 30 degrees forward,
knee bent 40") whatever way each bone happens to be rolled inside the rig:

  flex   swing forward (+) / back (-)         about the side-to-side axis
  bend   knee/elbow bend (+)
  out    lift away from the body sideways (+)
  twist  turn left (+) / right (-)            about the up axis
  lean   upper body forward (+) / back (-)

The rig's rest pose has the arms out in an A; `ARM_DOWN` brings them to the
sides first, so arm values are relative to hanging down.
"""
import math
import bpy
from mathutils import Matrix, Quaternion

ARM_DOWN = 50  # degrees from the rig's A-pose down to the sides
ELBOW_SIGN = 1
TWIST_SIGN = 1
FINGER_SIGN = 1
PALM = 45  # forearm turn so the palms face the thighs when the arms hang


def _rot(axis, deg):
    return Matrix.Rotation(math.radians(deg), 3, axis)


class Rig:
    def __init__(self, arm):
        self.arm = arm
        self.rest = {b.name: b.matrix_local.to_3x3() for b in arm.data.bones}
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"

    def set(self, bone, R):
        """R: a 3x3 rotation in armature (character) axes, relative to the parent."""
        B = self.rest[bone]
        L = B.inverted() @ R @ B
        self.arm.pose.bones[bone].rotation_quaternion = L.to_quaternion()

    def set_local(self, bone, axis, deg, extra=None):
        """A rotation about the bone's own axis (hinge joints: elbow, fingers)."""
        q = Quaternion(axis, math.radians(deg))
        if extra is not None:
            q = q @ extra
        self.arm.pose.bones[bone].rotation_quaternion = q

    def key(self, frame):
        for pb in self.arm.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=frame)
            pb.keyframe_insert("location", frame=frame)

    def pose(self, p):
        """p: dict of plain-language angles (degrees). Missing = neutral."""
        g = lambda k, d=0.0: p.get(k, d)
        # Character axes: X = his left, -Y = forward, Z = up.
        X, Y, Z = "X", "Y", "Z"
        for b in self.arm.pose.bones:
            b.rotation_quaternion = Quaternion()
            b.location = (0, 0, 0)
        lean, twist, side = g("lean"), g("twist"), g("side")
        self.set("pelvis", _rot(Z, twist * 0.4) @ _rot(X, lean * 0.25) @ _rot(Y, side * 0.5))
        self.set("spine_01", _rot(Z, twist * 0.2) @ _rot(X, lean * 0.3))
        self.set("spine_02", _rot(Z, twist * 0.2) @ _rot(X, lean * 0.25))
        self.set("spine_03", _rot(Z, twist * 0.2) @ _rot(X, lean * 0.2) @ _rot(Y, -side * 0.5))
        self.set("neck_01", _rot(Z, g("look") * 0.5) @ _rot(X, -lean * 0.35 + g("nod") * 0.5))
        self.set("head", _rot(Z, g("look") * 0.5) @ _rot(X, -lean * 0.35 + g("nod") * 0.5) @ _rot(Y, g("tilt")))
        for s, sign in (("l", 1), ("r", -1)):
            S = s.upper()
            flex, bend = p.get("hip" + S, (0, 0))[:2]
            hip_out = p.get("hip" + S, (0, 0, 0))[2] if len(p.get("hip" + S, (0, 0))) > 2 else 0
            self.set(f"thigh_{s}", _rot(Y, -hip_out * sign) @ _rot(X, -flex))
            self.set(f"calf_{s}", _rot(X, bend))
            self.set(f"foot_{s}", _rot(X, -g("toe" + S)))
            swing, out, elbow = p.get("arm" + S, (0, 0, 0))
            self.set(f"upperarm_{s}", _rot(X, -swing) @ _rot(Y, (ARM_DOWN - out) * sign))
            self.set_local(f"lowerarm_{s}", (1, 0, 0), ELBOW_SIGN * elbow,
                           Quaternion((0, 1, 0), math.radians(TWIST_SIGN * sign * p.get("palm" + S, PALM))))
            wrist = p.get("wrist" + S, 0)
            self.set(f"hand_{s}", _rot(X, -wrist))
            fist = p.get("fist" + S, 0.3)
            for f in ("index", "middle", "ring", "pinky"):
                for j in ("01", "02", "03"):
                    nm = f"{f}_{j}_{s}"
                    if nm in self.rest:
                        self.set_local(nm, (1, 0, 0), FINGER_SIGN * 70 * fist)
