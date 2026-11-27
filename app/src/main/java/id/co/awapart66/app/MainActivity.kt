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
    private var pendingSection: String? = null
    private val navy = Color.rgb(16,29,53)
    private val gold = Color.rgb(198,154,66)
    private fun dp(n: Int) = (n * resources.displayMetrics.density + 0.5f).toInt()
    private fun section(label: String) {
        if (webView.url?.contains("/portal.html") == true) {
            pendingSection = label
            webView.loadUrl(appUrl)
        } else activateSection(label)
    }
    private fun activateSection(label: String) {
        val quoted = org.json.JSONObject.quote(label)
        webView.evaluateJavascript("""(function(){const label=$quoted; const els=Array.from(document.querySelectorAll('a,button'));const el=els.find(e=>e.getClientRects().length && e.textContent.trim().toLowerCase()===label.toLowerCase());if(el){el.click();return true;}return false;})()""") { result ->
            if(result != "true") Toast.makeText(this, "Gunakan menu $label pada halaman customer.", Toast.LENGTH_SHORT).show()
        }
    }
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
            override fun onPageFinished(view: WebView, url: String) {
                super.onPageFinished(view, url)
                if (Uri.parse(url).host != "awapart66.com") return
                if (!Uri.parse(url).path.orEmpty().contains("portal.html")) {
                    view.evaluateJavascript("""(function(){if(document.getElementById('aw241-style'))return;const s=document.createElement('style');s.id='aw241-style';s.textContent='@media(max-width:720px){body{overflow-x:hidden}img{max-width:100%} .hero h1{font-size:clamp(24px,6vw,32px)!important;line-height:1.15!important} .hero{min-height:0!important;padding:20px!important} .hero p{font-size:15px!important;line-height:1.5!important} input,select,textarea{max-width:100%;box-sizing:border-box}}';document.head.appendChild(s);})();""", null)
                    pendingSection?.let { pendingSection = null; activateSection(it) }
                }
            }
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
        val header = TextView(this).apply {
            text = "AWAPART 66  •  APARTMENT RENTAL"
            setTextColor(gold)
            textSize = 13f
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16),0,dp(16),0)
            setTypeface(null, android.graphics.Typeface.BOLD)
        }
        layout.addView(header, LinearLayout.LayoutParams(-1,dp(44)))
        layout.addView(webView, LinearLayout.LayoutParams(-1,0,1f))
        val nav = LinearLayout(this).apply { setBackgroundColor(navy) }
        val items = listOf("⌂\nBeranda", "⌕\nCari unit", "▣\nBooking", "●\nAkun")
        items.forEachIndexed { index, label ->
            val tab = TextView(this).apply {
                text = label
                textSize = 13f
                gravity = Gravity.CENTER
                setTextColor(gold)
                isClickable = true
                isFocusable = true
                contentDescription = label.substringAfter("\n")
                setOnClickListener {
                    when(index) {
                        0 -> webView.loadUrl(appUrl)
                        1 -> section("Cari Apartemen")
                        2 -> section("Booking Saya")
                        3 -> AlertDialog.Builder(this@MainActivity).setTitle("Akun AWAPART 66")
                            .setItems(arrayOf("Customer", "Admin / Pemilik", "Kerja Sama")) { _, choice ->
                                when(choice) {
                                    0 -> webView.loadUrl(appUrl)
                                    1 -> webView.loadUrl("https://awapart66.com/portal.html")
                                    2 -> section("Kerja Sama")
                                }
                            }.show()
                    }
                }
            }
            nav.addView(tab, LinearLayout.LayoutParams(0,dp(62),1f))
        }
        layout.addView(nav)
        setContentView(layout)
        ViewCompat.requestApplyInsets(layout)
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
