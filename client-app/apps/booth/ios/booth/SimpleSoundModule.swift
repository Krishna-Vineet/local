import Foundation
import AudioToolbox
import React

@objc(SimpleSound)
class SimpleSoundModule: NSObject {
  @objc func play(_ name: String) {
    DispatchQueue.main.async {
      switch name {
      case "shutter":
        // 1108: iOS native camera shutter sound
        AudioServicesPlaySystemSound(1108)
      case "click":
        // 1104: UI tap sound
        AudioServicesPlaySystemSound(1104)
      case "beep":
        // 1052: Alert / countdown beep
        AudioServicesPlaySystemSound(1052)
      case "success":
        // 1025: Success notification chime
        AudioServicesPlaySystemSound(1025)
      default:
        AudioServicesPlaySystemSound(1104)
      }
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
