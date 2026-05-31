import Capacitor

class ShijianBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        bridge?.registerPluginType(PhotoLibraryPlugin.self)
    }
}
