import UIKit
import React

@objc(IdleTimer)
class IdleTimer: NSObject {
  @objc func setDisabled(_ disabled: Bool) {
    DispatchQueue.main.async {
      UIApplication.shared.isIdleTimerDisabled = disabled
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
