/**
 * The phone's goal-video encoder (android/…/GoalVideoEncoderModule.kt).
 * Absent (null) in Expo Go and the headless tools; on the iPhone it is there
 * but says isAvailable() false. Used only by src/match/goalClip/makeVideo.ts.
 */
import { requireOptionalNativeModule } from "expo";

export interface GoalVideoEncoderNative {
  isAvailable(): boolean;
  start(name: string, width: number, height: number, fps: number, bitrate: number, sampleRate: number, channels: number, pcm: Int16Array): boolean;
  addFrame(rgba: Uint8Array): void;
  finish(): Promise<{ uri: string; bytes: number }>;
  cancel(): void;
  decodeAudio(uri: string): Promise<Uint8Array>;
}

export const GoalVideoEncoder = requireOptionalNativeModule<GoalVideoEncoderNative>("GoalVideoEncoder");
