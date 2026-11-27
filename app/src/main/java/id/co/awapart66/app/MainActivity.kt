package id.co.awapart66.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    private var uploadCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var webView: WebView
    private val uploadRequest = 6102
    private val appUrl = "https://awapart66.com/customer.html"

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return if (uri.scheme == "https" && uri.host == "awapart66.com") {
                    false
                } else {
                    Toast.makeText(this@MainActivity, "Tautan eksternal dibuka melalui browser.", Toast.LENGTH_SHORT).show()
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                    if (uri.scheme == "https") {
                        try { startActivity(intent) } catch (_: android.content.ActivityNotFoundException) {}
                    }
                    true
                }
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                webView: WebView?,
                filePathCallback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                uploadCallback?.onReceiveValue(null)
                uploadCallback = filePathCallback
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = "*/*"
                    putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("image/jpeg", "image/png", "image/webp", "application/pdf"))
                }
                try { startActivityForResult(intent, uploadRequest) } catch (_: android.content.ActivityNotFoundException) {
                    uploadCallback?.onReceiveValue(null)
                    uploadCallback = null
                }
                return true
            }
        }
        val layout = android.widget.LinearLayout(this).apply { orientation = android.widget.LinearLayout.VERTICAL }
        val nav = android.widget.LinearLayout(this)
        listOf("Customer" to "/customer.html", "Admin / Pemilik" to "/portal.html").forEach { (label, path) ->
            nav.addView(android.widget.Button(this).apply {
                text = label
                setOnClickListener { webView.loadUrl("https://awapart66.com" + path) }
            }, android.widget.LinearLayout.LayoutParams(0, -2, 1f))
        }
        layout.addView(nav)
        layout.addView(webView, android.widget.LinearLayout.LayoutParams(-1, 0, 1f))
        setContentView(layout)
        if (savedInstanceState == null) webView.loadUrl(appUrl) else webView.restoreState(savedInstanceState)
    }

    override fun onSaveInstanceState(outState: Bundle) {
        webView.saveState(outState)
        super.onSaveInstanceState(outState)
    }

    @Deprecated("Deprecated by Android; retained for WebView file chooser compatibility")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == uploadRequest) {
            val result = if (resultCode == RESULT_OK) data?.data?.let { arrayOf(it) } else null
            uploadCallback?.onReceiveValue(result)
            uploadCallback = null
        }
    }

    @Deprecated("Use Android back dispatcher in a future update")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
