import ExpoModulesCore

// The iPhone has no goal-video encoder yet: it says so, and the button tells the player.
public class GoalVideoEncoderModule: Module {
  public func definition() -> ModuleDefinition {
    Name("GoalVideoEncoder")
    Function("isAvailable") { () -> Bool in false }
  }
}
