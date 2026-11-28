package id.co.awapart66.app

import android.annotation.SuppressLint
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.View
import android.webkit.WebResourceError
import android.webkit.WebResourceResponse
import android.widget.ProgressBar
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import android.widget.LinearLayout
import android.widget.TextView
import android.graphics.Color
import android.view.Gravity
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowCompat
import android.app.AlertDialog
import androidx.activity.ComponentActivity

class MainActivity : ComponentActivity() {
    private var uploadCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var webView: WebView
    private lateinit var nav: LinearLayout
    private lateinit var header: TextView
    private lateinit var offline: TextView
    private lateinit var progress: ProgressBar
    private val handler = Handler(Looper.getMainLooper())
    private var failed = false
    private val host = "awapart66.com"
    private lateinit var chooser: LinearLayout
    private lateinit var roleBar: LinearLayout
    private var access = ""
    private var shownNav = ""
    private val navy = Color.rgb(17,29,51)
    private val gold = Color.rgb(198,154,66)
    private fun dp(n: Int) = (n * resources.displayMetrics.density + 0.5f).toInt()
    private val homeUrl = "https://awapart66.com/"
    private fun openHome() { webView.loadUrl(homeUrl) }
    private val uploadRequest = 6102


    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true
        webView.settings.cacheMode = android.webkit.WebSettings.LOAD_NO_CACHE
        webView.settings.allowFileAccess = false
        webView.settings.allowContentAccess = true
        webView.settings.mixedContentMode = android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW
        webView.settings.javaScriptCanOpenWindowsAutomatically = false
        webView.settings.allowFileAccessFromFileURLs = false
        webView.settings.allowUniversalAccessFromFileURLs = false
        webView.settings.setSupportMultipleWindows(false)
        android.webkit.CookieManager.getInstance().setAcceptThirdPartyCookies(webView, false)
        if (android.os.Build.VERSION.SDK_INT >= 26) webView.settings.safeBrowsingEnabled = true
        WebView.setWebContentsDebuggingEnabled(false)
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (Uri.parse(url).host != host || failed) return
                progress.visibility = View.GONE
            }
            override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                failed = false
                nav.visibility = View.GONE
                header.visibility = View.GONE
                offline.visibility = View.GONE
                progress.visibility = View.VISIBLE
            }
            override fun onReceivedSslError(view: WebView, handler: android.webkit.SslErrorHandler, error: android.net.http.SslError) {
                handler.cancel()
                showOffline()
            }
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showOffline()
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, errorResponse: WebResourceResponse) {
                if (request.isForMainFrame && errorResponse.statusCode >= 400) showOffline()
            }
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                return if (uri.scheme == "https" && uri.host == host) {
                    false
                } else {
                    if (!request.isForMainFrame || !request.hasGesture()) return true
                    Toast.makeText(this@MainActivity, "Tautan eksternal dibuka melalui browser.", Toast.LENGTH_SHORT).show()
                    val intent = Intent(Intent.ACTION_VIEW, uri)
                    if (uri.scheme == "https" || uri.scheme == "mailto") {
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
        WindowCompat.setDecorFitsSystemWindows(window, false)
        WindowCompat.getInsetsController(window, window.decorView).apply {
            isAppearanceLightStatusBars = false
            isAppearanceLightNavigationBars = false
        }
        val layout = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(navy)
        }
        ViewCompat.setOnApplyWindowInsetsListener(layout) { v, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        header = TextView(this).apply {
            text = "AWAPART 66  •  APARTMENT RENTAL"
            setTextColor(gold)
            textSize = 13f
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16),0,dp(16),0)
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(header, LinearLayout.LayoutParams(-1,dp(44)))
        header.visibility = View.GONE
        progress = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply { isIndeterminate = true }
        layout.addView(progress, LinearLayout.LayoutParams(-1,dp(3)))
        offline = TextView(this).apply {
            text = "Koneksi bermasalah. Ketuk untuk mencoba lagi."
            setTextColor(gold); gravity = Gravity.CENTER; setPadding(dp(20),dp(24),dp(20),dp(24))
            visibility = View.GONE
            setOnClickListener { webView.reload() }
        }
        layout.addView(offline)
        layout.addView(webView, LinearLayout.LayoutParams(-1,0,1f))
        nav = LinearLayout(this).apply { setBackgroundColor(navy) }
        nav.visibility = View.GONE
        layout.addView(nav)
        setContentView(layout)
        ViewCompat.requestApplyInsets(layout)
        if (savedInstanceState == null || webView.restoreState(savedInstanceState) == null) openHome()
    }

    private fun jump(id: String) {
        val quoted = org.json.JSONObject.quote(id)
        webView.evaluateJavascript("document.getElementById($quoted)?.scrollIntoView({behavior:'smooth'})", null)
    }
    private fun showOffline() {
        failed = true
        nav.visibility = View.GONE
        header.visibility = View.GONE
        progress.visibility = View.GONE
        offline.visibility = View.VISIBLE
    }
    override fun onDestroy() {
        uploadCallback?.onReceiveValue(null)
        uploadCallback = null
        webView.destroy()
        super.onDestroy()
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
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
