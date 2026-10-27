import UIKit
import React

@objc(AirPrintModule)
class AirPrintModule: NSObject {
  @objc func print(
    _ options: NSDictionary,
    resolver resolve: @escaping RCTPromiseResolveBlock,
    rejecter reject: @escaping RCTPromiseRejectBlock
  ) {
    DispatchQueue.main.async {
      guard let bitmap = options["bitmap"] as? String else {
        reject("INVALID_DATA", "Missing bitmap data", nil)
        return
      }

      var rawData = bitmap
      if let commaIndex = rawData.firstIndex(of: ",") {
        rawData = String(rawData[rawData.index(after: commaIndex)...])
      }

      guard let imageData = Data(base64Encoded: rawData, options: .ignoreUnknownCharacters),
            let image = UIImage(data: imageData) else {
        reject("DECODE_ERROR", "Failed to decode image data", nil)
        return
      }

      let printController = UIPrintInteractionController.shared
      let printInfo = UIPrintInfo(dictionary: nil)
      printInfo.outputType = .photo
      printInfo.jobName = (options["jobName"] as? String) ?? "HappyPix Booth Print"

      let copies = (options["copies"] as? Int) ?? 1
      printInfo.orientation = image.size.width > image.size.height ? .landscape : .portrait

      printController.printInfo = printInfo
      printController.printingItem = image

      printController.present(animated: true) { (controller, completed, error) in
        if completed {
          resolve(["success": true, "jobId": "AIRPRINT-\(Int(Date().timeIntervalSince1970))"])
        } else if let error = error {
          reject("PRINT_FAILED", error.localizedDescription, error)
        } else {
          reject("PRINT_CANCELLED", "User cancelled printing", nil)
        }
      }
    }
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return true
  }
}
