import UIKit
import Capacitor

// A página toda rola no UIScrollView do WKWebView, e as barras dele não se
// escondem por CSS. Num app nativo não devem aparecer (as das listas e folhas
// que rolam por dentro escondem-se em base.css, na classe `.nativo`).
class MainViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        webView?.scrollView.showsVerticalScrollIndicator = false
        webView?.scrollView.showsHorizontalScrollIndicator = false
    }
}
