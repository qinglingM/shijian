import Capacitor
import Photos
import UIKit

@objc(PhotoLibraryPlugin)
class PhotoLibraryPlugin: CAPPlugin, CAPBridgedPlugin {
    let identifier = "PhotoLibraryPlugin"
    let jsName = "PhotoLibrary"
    let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise)
    ]

    @objc func saveImage(_ call: CAPPluginCall) {
        guard
            let dataUrl = call.getString("dataUrl"),
            let separator = dataUrl.firstIndex(of: ","),
            let imageData = Data(base64Encoded: String(dataUrl[dataUrl.index(after: separator)...])),
            let image = UIImage(data: imageData)
        else {
            call.reject("Invalid image data", "INVALID_IMAGE")
            return
        }

        let saveImage = {
            PHPhotoLibrary.shared().performChanges({
                PHAssetChangeRequest.creationRequestForAsset(from: image)
            }) { success, error in
                DispatchQueue.main.async {
                    if success {
                        call.resolve()
                    } else {
                        call.reject(error?.localizedDescription ?? "Unable to save image", "SAVE_FAILED", error)
                    }
                }
            }
        }

        switch PHPhotoLibrary.authorizationStatus(for: .addOnly) {
        case .authorized, .limited:
            saveImage()
        case .notDetermined:
            PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
                if status == .authorized || status == .limited {
                    saveImage()
                } else {
                    DispatchQueue.main.async {
                        call.reject("Photo library access denied", "PERMISSION_DENIED")
                    }
                }
            }
        default:
            call.reject("Photo library access denied", "PERMISSION_DENIED")
        }
    }
}
